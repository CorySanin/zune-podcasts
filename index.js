const Express = require('express');
const request = require('request');
const port = 8080;
const useragent = 'p2z'


var http = new Express();

http.use('/', Express.static('http-root'));

http.get('/out.xml', function (req, res) {
    let url = req.query.in;
    if(!/^[a-z]/.test(url.toLowerCase())){
        url = 'http://' + url;
    }
    if(!'user-agent' in req.headers || req.headers['user-agent'] !== useragent){
        res.setHeader('Content-Type', 'text/xml;charset=UTF-8');
        request({
            url,
            timeout: 2000,
            strictSSL: true,
            headers: {
                'User-Agent': useragent
            }
        }, function (error, response, body) {
            if(error){
                console.error('error:', error);
            }
            if(response && response.statusCode){
                res.status(response.statusCode);
            }
            res.send(body);
        });
    }
    else{
        res.status(500);
        res.send('bad url');
    }
});

http.listen(port, () => console.log(`patreon-to-zune listening on port ${port}!`));