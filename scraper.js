var request = require('request');
var cheerio = require('cheerio');
var Agenda = require('agenda');
var sendMessageApi = "";

if (process.env.ISDEBUG === "true") {
    sendMessageApi = process.env.DEBUG_TELEGRAM_MESSAGE_API_URL;
} else {
    sendMessageApi = process.env.RELEASE_TELEGRAM_MESSAGE_API_URL;
}
var mongoConnectionString = process.env.MONGOLAB_URL;

var scheduleScrapper = function () {

    var agenda = new Agenda({db: {address: mongoConnectionString}});
    agenda.define('scrap web', function (job, done) {
        scrapUrl();
        done();
    });

    agenda.on('ready', function () {
        agenda.every('24 hours', 'scrap web');
        agenda.start();
    });
};

var scrapUrl = function () {
    request('https://www.hsnstore.com/quamtrax/whey-matrix', function (err, resp, html) {
        if (err) {
            console.log("Error loading web");
            return;
        }

        const $ = cheerio.load(html);

        var productName = $('.product-name').find('h1').text();
        var productOldPrice = $('.block-price').children('#old-price-6980').text().replace("€", "").replace(',', '.').trim();
        var productNewPrice = $('.block-price').children('#product-price-6980').text().replace("€", "").replace(',', '.').trim();
        var discount = calculateDiscount(productOldPrice, productNewPrice);

        console.log(productName);
        console.log(quantityToCurrency(productOldPrice));
        console.log(quantityToCurrency(productNewPrice));
        console.log(quantityToCurrency(discount));

        request(sendMessageApi + generateBotMessage(productName, productOldPrice, productNewPrice, discount), function (error, response) {
            if (!error && response.statusCode === 200) {
                console.log("Message sent");
            }
        })
    });
};

var calculateDiscount = function (oldPrice, newPrice) {
    if (oldPrice === newPrice) {
        return 0;
    }

    return (parseFloat(oldPrice) * 100 - parseFloat(newPrice) * 100) / 100;
};

var quantityToCurrency = function (quantity) {
    return quantity + "%E2%82%AC";
};

var generateBotMessage = function (productName, productOldPrice, productNewPrice, discount) {
    return productName + "\n"
        + "Precio original: " + quantityToCurrency(productOldPrice) + "\n"
        + "Precio en oferta: " + quantityToCurrency(productNewPrice) + "\n"
        + "Descuento: -" + quantityToCurrency(discount) + "\n";
};

exports.scheduleScrapper = scheduleScrapper;
exports.scrapUrl = scrapUrl;