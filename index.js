var fs = require('fs');
var Intercom = require('intercom-client');
var request = require('request');

function login(baseUrl, username, password, cb) {
  var options = {
    url: baseUrl + '/api/auth/login',
    json: {
      username: username,
      password: password
    }
  };

  request.post(options, function(err, response, body) {
    if (err) {
      return cb(err, null);
    }

    if (response.statusCode !== 200) {
      var e = new Error('Could not log in');
      e.statusCode = repsonse.statusCode;
      return cb(e, null);
    }

    cb(null, body.response.authToken);
  });
}

function listCustomers(baseUrl, jwt, cb) {
  var options = {
    url: baseUrl + '/api/customers?filter[fields][name]=true&filter[fields][id]=true&filter[limit]=99999999&filter[include]=devices',
    headers: {
      Authorization: 'Bearer ' + jwt
    }
  };

  request.get(options, function (err, response, body) {
    if (err) {
      return cb(err, null);
    }

    if (response.statusCode !== 200) {
      var e = new Error('Could not list customers');
      e.statusCode = response.statusCode
      return cb(e, null);
    }

    cb(null, JSON.parse(body));
  });
}

let intercomCompanies = {};

function indexIntercomCompanies(companies) {
  companies.forEach(c => {
    intercomCompanies[c.company_id] = c;
  });
}

function listIntercomCompanies(client, cb) {
  client.companies.list()
  .then(_companies => {
    console.log(_companies.body.companies);

    indexIntercomCompanies(_companies.body.companies);

    if (_companies.body.pages.page >= _companies.body.pages.total_pages) {
      return cb();
    }
    _processIntercomCompanyPages(client, _companies.body.pages, cb);
  })
  .catch(function (err) {
    console.log(err);
  });
}

function _processIntercomCompanyPages(client, pages, cb) {
  client.nextPage(pages)
  .then(_companies => {
    console.log(_companies.body.companies);

    indexIntercomCompanies(_companies.body.companies);

    if (_companies.body.pages.page >= _companies.body.pages.total_pages) {
      return cb();
    }
    _processIntercomCompanyPages(client, _companies.body.pages, cb);
  });
}

let companies = [];
let companyIndex = 0;
function updateCompanies(prefix, client) {
  if (companyIndex >= companies.length) {
    console.log('all done!');
    return;
  }

  const company = companies[companyIndex];
  let createdAt = new Date().getTime()/1000;

  if (intercomCompanies.hasOwnProperty(company.id)) {
    createdAt = intercomCompanies[company.id].created_at;
  }

  client.companies.create({
    company_id: company.id,
    name: prefix + company.name,
    remote_created_at: createdAt,
    monthly_spend: company.devices.length * 150,
  })
  .then(response => {
    if (!response.ok) {
      console.log('Error creating company');
      console.log(response);
      companyIndex += 1;
      updateCompanies(prefix, client);
    } else {
      console.log('new company:', response.body);
      companyIndex += 1;
      updateCompanies(prefix, client);
    }
  })
  .catch(function (err) {
    console.log('error:', err);
    companyIndex += 1;
    updateCompanies(prefix, client);
  });
}

function syncIntercomUsers(baseUrl, prefix, username, password, appId, apiKey) {
  login(baseUrl, username, password, function (err, jwt) {
    if (err) {
      console.log('could not log in to call home: ', err);
      return;
    }

    listCustomers(baseUrl, jwt, function(err, customers) {
      companies = customers;
      var client = new Intercom.Client({
        appId: appId,
        appApiKey: apiKey
      }).usePromises();

      listIntercomCompanies(client, () => {
        updateCompanies(prefix, client);
      });
    });
  });
}

fs.readFile('params.json', {encoding: 'utf-8'}, function (err, data) {
  if (err) {
    console.log(err);
    return;
  }

  var params = JSON.parse(data);
  syncIntercomUsers(params.callHomeUrl, params.prefix,
    params.callHomeUsername, params.callHomePassword,
    params.intercomAppId, params.intercomApiKey);
});