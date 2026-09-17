module.exports=function(req,res){res.setHeader('Cache-Control','no-store');return res.status(200).json({serverTime:Date.now()});};
