const Express = require('express');
const phin = require('phin');
const httpProxy = require('http-proxy');
const exuseragent = require('express-useragent');
const prom = require('prom-client');
const fs = require('fs');
const path = require('path');
const atob = require('atob');
const btoa = require('btoa');
const useragent = 'p2z';
const cfgfile = './config/config.json';
const LEADINGAMP = new RegExp('(https?://[^\\s]+\\?)&amp;([^<"\\s]+)', 'g');
const XMLENCODEDAMP = new RegExp('&amp;', 'g');
const MATCHURL = new RegExp(/https:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:;%_\+.~#?&//=]*)/, 'g');
const MATCHHEX = new RegExp('^[0-9a-fA-F]{1,3}$');
const MATCHBIN = new RegExp('^[01]{1,12}$');
const METRICPREFIX = 'zunepodcast_';
const proxy = httpProxy.createProxyServer({
    secure: false,
    changeOrigin: true,
    ignorePath: true,
    followRedirects: true
});
const unsupportedAgents = [
    'Windows XP',
    'Windows Vista',
    'Windows 7'
];

let config = {
    port: process.env.PORT || 8080,
    privateport: process.env.PRIVATEPORT || 8081,
    blacklist: (process.env.BLACKLIST || 'true').toLowerCase() === 'true',
    domainlist: (process.env.DOMAINLIST) ? process.env.DOMAINLIST.split(',') : [],
    deepproxy: (process.env.DEEPPROXY || 'false').toLowerCase() === 'true',
    deepproxyurl: process.env.DEEPPROXYURL || false,
    logrequestnum: (process.env.LOGREQUESTNUM || 'false').toLowerCase() === 'true',
    logrequestdomains: (process.env.LOGREQUESTDOMAINS || 'false').toLowerCase() === 'true',
    logdir: './'
}

/**
 * Check if domain is on the blacklist
 * @param {string} domain 
 */
function notBlacklisted(domain) {
    for (let i = 0; i < config.domainlist.length; i++) {
        if (domain.includes(config.domainlist[i])) {
            return !config.blacklist;
        }
    }
    return config.blacklist;
}

/**
 * Increment the number of requests in the appropriate log
 */
function bumpLogCount() {
    if (config.logrequestnum) {
        let today = new Date();
        logPath = path.join(config.logdir, 'p2z_' + today.getFullYear() + '.json');
        let data = {};
        try {
            data = JSON.parse(fs.readFileSync(logPath, { encoding: 'utf8' }));
        }
        catch (ex) {
            console.log(ex);
        }
        let month = today.getMonth() + 1;
        if (!(month in data)) {
            data[month] = {};
        }
        data[month].requests = ('requests' in data[month]) ? data[month].requests + 1 : 1;
        fs.writeFileSync(logPath, JSON.stringify(data), { encoding: 'utf8' });
    }
}

/**
 * Gets the filename and extension of a URL
 * @param {string} url
 */
function getFilename(url) {
    url = url.split('/').pop().replace(/\#(.*?)$/, '').replace(/\?(.*?)$/, '');
    url = url.split('.');
    if (url.length >= 2 && url[url.length - 1]) {
        url[1] = `.${url[url.length - 1]}`;
    }
    return { filename: (url[0] || ''), ext: (url[1] || '') }
}

/**
 * Remove leading ampersands from get queries
 * (Zune doesn't like leading ampersands)
 * @param {string} feed 
 */
function fixUrls(feed) {
    return feed.replace(LEADINGAMP, '$1$2');
}

/**
 * Replace all URLs with proxied ones if deepproxy is enabled
 * @param {string} feed 
 */
function proxifyUrls(feed, host) {
    return (config.deepproxy === true) ? feed.replace(MATCHURL, match => {
        return `${host}/proxy/file${getFilename(match).ext}?url=${encodeURIComponent(btoa(match.replace(XMLENCODEDAMP, '&')))}`;
    }) : feed;
}

/**
 * Add a new domain to the log of domains being proxied to
 * @param {string} domain 
 */
function logDomain(domain) {
    if (config.logrequestdomains) {
        let today = new Date();
        logPath = path.join(config.logdir, 'p2z_' + today.getFullYear() + '.json');
        let data = {};
        try {
            data = JSON.parse(fs.readFileSync(logPath, { encoding: 'utf8' }));
        }
        catch (ex) {
            console.log(ex);
        }
        let month = today.getMonth() + 1;
        if (!(month in data)) {
            data[month] = {};
        }
        let domains = []
        if ('domains' in data[month]) {
            domains = data[month].domains;
        }
        if (domains.indexOf(domain) < 0) {
            domains.push(domain);
            data[month].domains = domains;
            fs.writeFileSync(logPath, JSON.stringify(data), { encoding: 'utf8' });
        }
    }
}

/**
 * Given a user agent string, return true if the OS is detected to be EOL
 * @param {string} useragent 
 */
function nonsupported(useragent) {
    for (var i = 0; i < unsupportedAgents.length; i++) {
        if (useragent.os.includes(unsupportedAgents[i])) {
            return true;
        }
    }
    return false;
}

let register = prom.register;
let http = new Express();
let privateapp = new Express();
let metrics = {
    feeds: new prom.Counter({
        name: `${METRICPREFIX}feed_request_count`,
        help: 'Number of requests to each feed',
        labelNames: ['feed', 'domain']
    }),
    proxiedreq: new prom.Counter({
        name: `${METRICPREFIX}proxied_items_count`,
        help: 'number of items that have been proxied through the service',
        labelNames: ['mime', 'domain']
    }),
    proxieddata: new prom.Counter({
        name: `${METRICPREFIX}proxied_items_bytes`,
        help: 'Data transferred over proxy in bytes',
        labelNames: ['mime', 'domain']
    }),
}

http.use(exuseragent.express());
http.use('/', Express.static('http-root'));
http.set('view engine', 'ejs');

http.get('/', function (req, res) {
    res.render('index', {
        config,
        nonsupported: nonsupported(req.useragent)
    });
});

http.get('/ring/:id', function (req, res) {
    let id = -1;
    if (MATCHHEX.test(req.params['id'])) {
        id = parseInt(req.params['id'], 16);
    }
    else if (MATCHBIN.test(req.params['id'])) {
        id = parseInt(req.params['id'], 2);
    }
    if (id >= 0) {
        let rings = [];
        for (let i = 0; i < 12; i++) {
            rings.push((id >> i) & 1);
        }
        res.set('Content-Type', 'image/svg+xml');
        res.render('dev-ring', {
            rings
        });
    }
    else {
        res.status(403);
        res.send();
    }
});

http.get('/feed/out.xml', async function (req, res) {
    if (req.useragent.browser.toLowerCase() == 'zune' || (req.query.debug && req.query.debug === 'true')) {
        let url = req.query.in;
        if (!/^[a-z]+:\/\//.test(url.toLowerCase())) {
            url = 'http://' + url;
        }
        let domain = url.split('/');
        let feed = url.split('?', 2);
        domain = domain[2];
        feed = feed[0];
        if (!'user-agent' in req.headers || req.headers['user-agent'] !== useragent && notBlacklisted(domain)) {
            const resp = await phin({
                url,
                method: 'GET',
                followRedirects: true,
                headers: {
                    'User-Agent': useragent
                }
            });

            if (resp && 'body' in resp) {
                if (resp.statusCode) {
                    res.status(resp.statusCode);
                }
                res.set('Content-Type', 'text/xml;charset=UTF-8');
                let body = null;
                try {
                    body = proxifyUrls(fixUrls(resp.body.toString()), `${req.protocol}://${req.headers.host}`);
                }
                catch (err) {
                    console.log(err);
                }
                res.send(body);
            }

            metrics.feeds.inc({ feed, domain });
        }
        else {
            res.status(500);
            res.send('bad url');
        }
        bumpLogCount();
        logDomain(domain);
    }
    else {
        res.send(`Copy the URL in the address bar and paste it into the Zune software.`);
    }
});

http.get('/proxy/:filename', async function (req, res) {
    try {
        const proxurl = atob(req.query['url']);
        if (config.deepproxy === true && notBlacklisted(proxurl)) {
            console.log(`Proxy to ${proxurl}`);
            proxy.web(req, res, {
                target: proxurl
            }, function (ex) {
                if (ex) {
                    res.status(403);
                    res.send();
                }
            });
        }
        else {
            res.status(403);
            res.send();
        }
    }
    catch (err) {
        res.status(403);
        res.send();
    }
});

http.get('/out.xml', function (req, res) {
    res.redirect('/feed/out.xml?in=' + req.query.in);
});

privateapp.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    }
    catch (ex) {
        res.status(500).send(ex);
    }
});

prom.collectDefaultMetrics({
    prefix: METRICPREFIX
});

proxy.on('proxyRes', (res) => {
    metrics.proxiedreq.inc({ mime: res.headers['content-type'], domain: res.client.servername });
    metrics.proxieddata.inc({ mime: res.headers['content-type'], domain: res.client.servername }, parseInt(res.headers['content-length']));
});

fs.readFile(cfgfile, 'utf8', function (err, data) {
    if (!err) {
        try {
            data = JSON.parse(data);
            for (let key in data) {
                config[key] = data[key];
            }
        }
        catch (e) {
            console.log('config file couldn\'t be read. Using defaults and environment variables instead.');
        }
    }
    else {
        console.log('No config file found. Loading default configuration.');
    }
    http.listen(config.port, () => console.log(`zune-podcasts listening on port ${config.port}!`));
    privateapp.listen(config.privateport, () => { });
});