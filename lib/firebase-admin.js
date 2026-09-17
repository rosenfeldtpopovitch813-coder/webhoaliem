const admin=require('firebase-admin');
function getAdmin(){if(admin.apps.length)return admin.app();const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;if(!raw)throw new Error('Missing server Firebase credentials');return admin.initializeApp({credential:admin.credential.cert(JSON.parse(raw)),databaseURL:process.env.FIREBASE_DATABASE_URL||'https://thikscl-default-rtdb.firebaseio.com'});}
async function verifyUser(req){const token=String(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token)throw Object.assign(new Error('Authentication required'),{status:401});try{return await admin.auth().verifyIdToken(token);}catch{throw Object.assign(new Error('Invalid token'),{status:401});}}
module.exports={getAdmin,verifyUser};
