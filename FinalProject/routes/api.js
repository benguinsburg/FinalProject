const OAuth2 = require('oauth').OAuth2;
const Twitter = require('twitter')

const express = require('express')
const router = express.Router()

const twitterConfig = require('../config/twitter')
const dandelionConfig = require('../config/dandelion')

const request = require('request-promise-lite')
const async = require('async')

///////////////////////////////////////////////////////////
var client = new Twitter({
    consumer_key: twitterConfig.CONSUMER_KEY,
    consumer_secret: twitterConfig.CONSUMER_SECRET,
    access_token_key: twitterConfig.ACCESS_TOKEN,           //User based authentication
    access_token_secret: twitterConfig.ACCESS_TOKEN_SECRET  //User based authentication
    //bearer_token: ''    //wtf??
});

///////////////////////////////////////////////////////////

//Helper for authorization
const authorized = require('./authCheck')

const mongoose = require('mongoose')
if (!mongoose.connection.db) {
    mongoose.connect('mongodb://localhost/cs591')
}
const db = mongoose.connection
const Schema = mongoose.Schema
const personSchema = new Schema({
    name      : String,
    UID       : String,
    department: String
})
const tweetSchema = new Schema({
    body    : String,
    ID      : Number
})

const people = mongoose.model('people', personSchema)
const tweetsModel = mongoose.model('tweetsModel', tweetSchema)


router.route('/fetch') //get the tweets, put them into db, send to Dandelion API
    .get(function (req, res, next) {
        console.log('Starting waterfall')
        async.waterfall([getTweets, saveTweets, getSentiment],
            function (err, result, city) {
                console.log('Waterfall over... returning result: '+result)
                res.send(result)
            })
    })

//grabs Donald Trump's last 100 tweets
const getTweets = function (cb) {
    console.log("getting tweets...")
//    return new Promise(function (resolve, reject) {
        /*client.get('search/tweets', {q : 'from:realDonaldTrump', count : 2}, function (error, tweets, response) {
            if(error) throw error;
            let data = tweets.statuses
            console.log("tweets received, here's the data: " + data)   //array of tweets, use the .text to get tweet body
            resolve()
        })*/
        client.get('search/tweets', {q : 'from:realDonaldTrump', count : 2})
            .then(function (tweet) {
                let data = tweet.statuses
                console.log("tweets received, here's the data: " + data)   //array of tweets, use the .text to get tweet body
                cb(null, data)
            })

//        cb(null, data)

}

//shove the tweets into the local database
const saveTweets = function (data, cb, error) {
    //return new Promise(function (resolve, reject) {
        console.log("saving tweets...")
        for (i=0; i<data.length; i++){
            let aTweet = new tweetsModel( {body: data[i].text, ID: data[i].id} )
            aTweet.save()
                .then(function () {
                    console.log("successfully saved tweet: " + data[i].text)
                })
            /*aTweet.save(function (err) {
                if (err) {console.log(err)}
                else {console.log("successfully saved tweet: " + data[i].text)}
            })*/
        }
        //resolve()
        cb(null, data)
    //})
}

//gets sentiment rating for each tweets, returns average of collected values
const getSentiment = function (data, cb) {
    console.log("getting sentiment...")
    let sentimentArray = []

    const token = dandelionConfig.TOKEN

    //queries the Dandelion API sentiment extraction for each tweet in 'data', called from sentimentPromises
    let calcSentiment = function (tweet) {
        let options = {
            method: 'GET',
            url: 'https://api.dandelion.eu/datatxt/sent/v1',
            qs:
                { token: dandelionConfig.TOKEN,
                    text: tweet.text }
        }
        return new Promise(function (resolve, reject){
            request.get(options, {json: true})
                .then(function (response) {
                    sentimentArray.push(response.sentiment.score)
                    console.log(response.sentiment.score)
                    resolve()
                })
        })
    }

    //maps all statuses in "data" to calcSentiment with promises, then calls back with average of collected values
    console.log("starting sentiment analysis loop")
    let sentimentPromises = data.map(calcSentiment)

    Promise.all(sentimentPromises)
        .then(function () {
            let sum = 0
            for (i=0; i<sentimentArray.length; i++) sum+=sentimentArray[i];
            let avg = sum / sentimentArray.length
            cb(null, avg)
        })

}

/*router.get('/fetch', function (req, res, next) {
    console.log("got here in api/fetch")
    var options = {
        hostname: 'api.twitter.com',
        //this path will search for tweets from Donald Trump
        //return last 100 tweets
        path: 'https://api.twitter.com/1.1/search/tweets.json?q=from%3ArealDonaldTrump&count=100',
        headers: {
            Authorization: 'Bearer ' + token
        }
    };

    /!*https.get(options, function(result){
        var buffer = '';
        result.setEncoding('utf8');
        result.on('data', function(data){
            buffer += data;
        });
        console.log(buffer)
        result.on('end', function(){
            var tweets = JSON.parse(buffer);
            console.log(tweets)
            res.send(tweets);
        });
    });*!/

    /!*var data = twitter.getUserTimeline({ screen_name: username, count: '10'}, function(error, response, body){
        res.send({
            "error" : error
        });
    }, function(data){
        tweets.save(function(err){
            if (err) {res.send(err)}
            else {console.log(data)}
        })
    });*!/

})*/

/*router.get('/calculate', function (req, res, next){

})*/

///////////////////////////////////////////////////////////////////////////END OF MODS

// POST Create a new user (only available to logged-in users)
router.post('/db', authorized, function (req, res, next) {
    aPerson = new people(
        req.body
    )
    aPerson.save(function (err) {
        if (err) {
            res.send(err)
        }
        //send back the new person
        else {
            res.send(aPerson)
        }
    })
})

//GET Fetch all users
router.get('/db', function (req, res, next) {
    people.find({}, function (err, results) {
        res.json(results)
    })

})

/*
 //GET Fetch single user, match /users/db/Frank
 router.get('/db/:_id', function (req, res, next) {
 people.find({_id: req.param('_id')}, function (err, results) {
 res.json(results);
 });
 });
 */

router.get('/db/:name', function (req, res, next) {
    findByName(req.params.name)
        .then(function (status) {
            res.json(status)
        })
        .catch(function (status) {
            res.json(status)

        })
})

//PUT Update the specified user's name
router.put('/db/:_id', function (req, res, next) {
    people.findByIdAndUpdate(req.params._id, req.body, {'upsert': 'true'}, function (err, result) {
        if (err) {
            res.json({message: 'Error updating'})
        }
        else {
            console.log('updated')
            res.json({message: 'success'})
        }

    })

})


//DELETE Delete the specified user
router.delete('/db/:_id', function (req, res, next) {
    people.findByIdAndRemove(req.params._id, function (err, result) {
        if (err) {
            res.json({message: 'Error deleting'})
        }
        else {
            res.json({message: 'success'})
        }
    })
})


let findByName = function (checkName) {
    return new Promise(function (resolve, reject) {
        people.find({name: checkName}, function (err, results) {
            console.log(results, results.length)
            if (results.length > 0) {
                resolve({found: results})
            }
            else {
                reject({found: false})
            }
//    return ( (results.length  > 0) ? results : false)
        })
    })
}

module.exports = router

//TODO Route to log out (req.logout())