const OAuth2 = require('OAuth').OAuth2
var https = require('https')

const Twitter = require('twitter')

const express = require('express')
const router = express.Router()

const twitterConfig = require('../config/twitter')
const dandelionConfig = require('../config/dandelion')

const request = require('request-promise-lite')
const async = require('async')

var client = new Twitter({
    consumer_key: twitterConfig.CONSUMER_KEY,
    consumer_secret: twitterConfig.CONSUMER_SECRET,
    access_token_key: twitterConfig.ACCESS_TOKEN,           //User based authentication
    access_token_secret: twitterConfig.ACCESS_TOKEN_SECRET  //User based authentication
});

///////////////////////////////////////////////////////////
/*router.route('/test')
    .get(function (req, res, next) {
        console.log("runnint twitter test")

        var oauth2 = new OAuth2(twitterConfig.CONSUMER_KEY, twitterConfig.CONSUMER_SECRET, 'https://api.twitter.com/', null, 'oauth2/token', null);
        oauth2.getOAuthAccessToken('', {
            'grant_type': 'client_credentials'
        }, function (e, access_token) {
            console.log(access_token); //string that we can use to authenticate request

            var options = {
                hostname: 'api.twitter.com',
                path: '/1.1/search/tweets.json?q=from%3ArealDonaldTrump&count=2',
                headers: {
                    Authorization: 'Bearer ' + access_token
                }
            };


            https.get(options, function (result) {
                var buffer = '';
                result.setEncoding('utf8');
                result.on('data', function (data) {
                    buffer += data;
                });
                result.on('end', function () {
                    var tweets = JSON.parse(buffer);
                    console.log(tweets); // the tweets!
                });
            });
        });
    })*/

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
    id      : Number
})

const people = mongoose.model('people', personSchema)
const tweetsModel = mongoose.model('tweetsModel', tweetSchema)


router.route('/fetch') //get the tweets, put them into db, send to Dandelion API
    .get(function (req, res, next) {
        console.log('Starting waterfall')
        async.waterfall([getTweets, saveTweets, getSentiment],
            function (err, result, city) {
                console.log('Waterfall over... returning result: '+result)
                res.send(String(result))    //this is so stupid...why can't it just support Numbers..
            })
    })

//grabs Donald Trump's last 100 tweets
const getTweets = function (cb) {
    console.log("getting tweets...")

    //gets token for application session
    return new Promise(function (resolve, reject) {
        var oauth2 = new OAuth2(twitterConfig.CONSUMER_KEY, twitterConfig.CONSUMER_SECRET, 'https://api.twitter.com/', null, 'oauth2/token', null);
        oauth2.getOAuthAccessToken('', {
            'grant_type': 'client_credentials'
        }, function (e, access_token) {
            console.log(access_token); //string that we can use to authenticate request

            var options = {
                hostname: 'api.twitter.com',
                path: '/1.1/search/tweets.json?q=from%3ArealDonaldTrump&count=100',
                headers: {
                    Authorization: 'Bearer ' + access_token
                }
            };

            https.get(options, function (result) {
                var buffer = '';
                result.setEncoding('utf8');
                result.on('data', function (data) {
                    buffer += data;
                });
                result.on('end', function () {
                    var jsonBuffer = JSON.parse(buffer);
                    var tweets = jsonBuffer.statuses
                    console.log('got the tweets'); // the tweets!
                    cb(null, tweets)
                });
            });
        });
        resolve()
    })


}
/*const getTweets = function (cb) {
    console.log("getting tweets...")
    //return new Promise(function (resolve, reject) {
        client.get('search/tweets', {q: 'from:realDonaldTrump', count: 2})
            .then(function (tweet) {
                let data = tweet.statuses
                console.log("tweets received, here's the data: " + data)   //array of tweets, use the .text to get tweet body
                cb(null, data)
            })
            .catch(function (error) {
                console.log(error)
                throw error
            })
    //})
}*/

//shove the tweets into the local database
const saveTweets = function (tweets, cb, error) {
    //return new Promise(function (resolve, reject) {
        console.log("saving tweets...")
        for (i=0; i<tweets.length; i++){
            let aTweet = new tweetsModel( {body: tweets[i].text, id: tweets[i].id} )
            aTweet.save()
                .then(function () {
                    console.log("successful save")
                })
                .catch(function (error) {
                    console.log(error)
                    throw error
                })
            /*aTweet.save(function (err) {
                if (err) {console.log(err)}
                else {console.log("successfully saved tweet: " + data[i].text)}
            })*/
        }
        //resolve()
        cb(null, tweets)
    //})
}

//gets sentiment rating for each tweets, returns average of collected values
const getSentiment = function (tweets, cb) {
    //return new Promise(function () {
        console.log("getting sentiment...")
        let sentimentArray = []

        const token = dandelionConfig.TOKEN

        //queries the Dandelion API sentiment extraction for each tweet, called from sentimentPromises
        let calcSentiment = function (tweet) {
            var request = require("request");
            let options = {
                method: 'GET',
                url: 'https://api.dandelion.eu/datatxt/sent/v1',
                qs:
                    { token: dandelionConfig.TOKEN,
                        text: tweet.text }
            };

            return new Promise(function (resolve, reject){
                request.get(options, function (error, response, body) {
                    if (error) throw new Error(error);

                    console.log(body);
                    let jsonBody = JSON.parse(body);
                    let jsonSentiment = jsonBody.sentiment
                    sentimentArray.push(jsonSentiment.score)
                    resolve()
                });
                /*request.get(options, {json: true})
                    .then(function (response) {
                        sentimentArray.push(response.sentiment.score)
                        console.log(response.sentiment.score)
                        resolve()
                    })
                    .catch(function (error) {
                        console.log(error)
                        throw error
                    })*/
            })
        }

        //maps all statuses in "tweets" to calcSentiment with promises, then calls back with average of collected values
        let sentimentPromises = tweets.map(calcSentiment)

        Promise.all(sentimentPromises)
            .then(function () {
                let sum = 0
                for (i=0; i<sentimentArray.length; i++) sum+=sentimentArray[i];
                let avg = sum / sentimentArray.length
                cb(null, avg)
            })

    //})
}

// POST calculate the verbal description of mood
router.post('/word', authorized, function (req, res, next) {
    let mood = req.body.mood
    console.log("trying for the word")
    //describe the value
    let buffer = ""
    wordBank = ["really", "moderately", "a bit"] //really:>50, moderately:>25, a bit:<25
    emotionBank = ["angry", "happy"] //angry:<0, neutral:0, happy:>0
    if (Math.abs(mood) > 50 ) buffer.concat(wordBank[0])
    else if (Math.abs(mood) > 25) buffer.concat(wordBank[1])
    else buffer.concat(wordBank[2])

    if (mood <0) buffer.concat(emotionBank[0])
    else buffer.concat(emotionBank[1])

    res.json(buffer)
})

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