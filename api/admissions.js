'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('../lib/http');

module.exports = async function(req,res){
  http.noStore(res);
  if(!http.method(res,req,['GET']))return;
  try{
    const file=path.join(__dirname,'..','config','admissions-2026.json');
    const raw=JSON.parse(fs.readFileSync(file,'utf8'));
    return http.ok(res,raw);
  }catch(error){console.error('[admissions]',error?.message||error);return http.serverError(res);}
};
