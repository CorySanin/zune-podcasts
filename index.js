const Express = require('express');
const request = require('request');
const fs = require('fs');
const useragent = 'p2z';
const cfgfile = './config/config.json';

let config = {
    port: 8080,
    blacklist: true,
    domainlist: []
}

/**
 * Check if domain is on the blacklist
 * @param {string} domain 
 */
function notBlacklisted(domain){
    for(let i = 0; i < config.domainlist.length; i++){
        if(domain.includes(config.domainlist[i])){
            return !config.blacklist;
        }
    }
    return config.blacklist;
}

let http = new Express();

http.use('/', Express.static('http-root'));

http.get('/out.xml', function (req, res) {
    let url = req.query.in;
    if(!/^[a-z]+:\/\//.test(url.toLowerCase())){
        url = 'http://' + url;
    }
    let domain = url.split('/');
    domain = domain[2];
    if(!'user-agent' in req.headers || req.headers['user-agent'] !== useragent && notBlacklisted(domain)){
        request({
            url,
            timeout: 2000,
            strictSSL: true,
            headers: {
                'User-Agent': useragent
            }
        }, function (error, response, body) {
            if(response && response.statusCode){
                res.status(response.statusCode);
            }
            if(error){
                console.error('error:', error);
            }
            else{
                res.setHeader('Content-Type', 'text/xml;charset=UTF-8');
            }
            res.send(body);
        });
    }
    else{
        res.status(500);
        res.send('bad url');
    }
});


fs.readFile(cfgfile, 'utf8', function(err, data){
    if(!err){
        try{
            data = JSON.parse(data);
            for(let key in data){
                config[key] = data[key];
            }
        }
        catch(e){
            console.log(e);
        }
    }
    else{
        console.log('No config file found. Loading default configuration.');
    }
    http.listen(config.port, () => console.log(`patreon-to-zune listening on port ${config.port}!`));
})