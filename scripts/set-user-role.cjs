'use strict';
/* Run locally/secure CI only. Never commit a service account JSON file. */
const admin=require('firebase-admin');
const uid=process.argv[2];const role=process.argv[3];
if(!uid||!['student','teacher','admin'].includes(role)){console.error('Usage: node scripts/set-user-role.cjs <UID> <student|teacher|admin>');process.exit(2);}
const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;if(!raw){console.error('FIREBASE_SERVICE_ACCOUNT_JSON is required.');process.exit(2);}
admin.initializeApp({credential:admin.credential.cert(JSON.parse(raw)),databaseURL:process.env.FIREBASE_DATABASE_URL});
(async()=>{const user=await admin.auth().getUser(uid);const claims={...(user.customClaims||{})};delete claims.admin;delete claims.teacher;delete claims.role;if(role==='admin'){claims.admin=true;claims.teacher=true;}else if(role==='teacher'){claims.teacher=true;}claims.role=role;await admin.auth().setCustomUserClaims(uid,claims);console.log(`Updated role=${role} for ${uid}. User must refresh ID token by signing out/in.`);await admin.app().delete();})().catch(async e=>{console.error(e.message||e);try{await admin.app().delete()}catch{}process.exit(1)});
