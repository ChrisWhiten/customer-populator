## Customer Populator

This script populates Intercom with our own customers, since we only pass the tenant ID when users log in through Video Discovery.  It is designed to be run at a regular interval (say, every 24 hours).  To run:

- Copy `params.json.tmpl` to `params.json`
- Populate `params.json` with valid data
- `npm install`
- `node .`