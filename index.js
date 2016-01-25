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
    url: baseUrl + '/api/customers?filter[fields][name]=true&filter[fields][id]=true&filter[limit]=99999999',
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

function syncIntercomUsers(baseUrl, prefix, username, password, appId, apiKey) {
  login(baseUrl, username, password, function (err, jwt) {
    if (err) {
      console.log('could not log in to call home: ', err);
      return;
    }

    listCustomers(baseUrl, jwt, function(err, customers) {
      var client = new Intercom.Client({
        appId: appId,
        appApiKey: apiKey
      }).usePromises();

      // creating a company that already exists seems to be a no-op,
      // so just create a company for each solink customer
      customers.forEach(function (company) {
        client.companies.create({
        company_id: company.id,
        name: prefix + company.name
      })
        .then(function (response) {
          if (!response.ok) {
            console.log('Error creating company');
            console.log(response);
          } else {
            console.log('new company:', response.body);
          }
        })
        .catch(function (err) {
          console.log('error:', err);
        });
      });

      // list companies
      /*client.companies.list()
        .then(function (companies) {
          console.log(companies.body);
        })
        .catch(function (err) {
          console.log(err);
        });*/

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