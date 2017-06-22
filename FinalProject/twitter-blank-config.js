/*
 Configuration information for Twitter API authorization. DO NOT push this to github
 Note: rename this file to twitter.js to match the require AND move to /config folder
 */

const Twitter = {
    CONSUMER_KEY: 'c4f1fQrV6LDRI1zIIGP7Lu1LN ',
    CONSUMER_SECRET: 'Gu2DyAYuGHdbsgkFLInTKqEkWyPDLcFpQrvufNXhSBbbe6uRgm',
    OWNER_ID: '622513053',
    CALLBACK_URL: 'http://localhost:3000/auth/callback',
    REQ_TOKEN_URL: 'https://api.twitter.com/oauth/request_token',
    AUTHORIZE_URL: 'https://api.twitter.com/oauth/authorize',
    ACCESS_TOKEN_URL: 'https://api.twitter.com/oauth/access_token'
}

module.exports = Twitter