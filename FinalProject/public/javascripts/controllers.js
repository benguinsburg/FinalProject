angular.module('cs411', ['ngRoute', 'ngCookies'])

    .controller('cs411ctrl', function ($scope, $http, $cookies) {

        //CREATE (POST)
        $scope.createUser = function () {
            if ($scope.dbID) {
                $scope.updateUser($scope.dbID)
            }
            else {
                const request = {
                    method: 'post',
                    url: 'http://localhost:3000/api/db',
                    data: {
                        name: $scope.name,
                        UID: $scope.UID,
                        department: $scope.department
                    }
                }
                $http(request)
                    .then(function (response) {
                            $scope.inputForm.$setPristine()
                            $scope.name = $scope.UID = $scope.department = ''
                            $scope.getUsers()
                            console.log(response)
                        },
                        function (error) {
                            if (error.status === 401) {
                                $scope.authorized = false
                                $scope.h2message = "Not authorized to add "
                                console.log(error)
                            }
                        }
                    )
            }
        }
        //READ (GET)
        $scope.getUsers = function () {
            $http.get('http://localhost:3000/api/db')
                .then(function (response) {
                    $scope.users = response.data

                })
        }
        //UPDATE (PUT)
        $scope.setUserUpdate = function (user) {
            $scope.buttonMessage = "Update User"
            $scope.h2message = "Updating "
            $scope.name = user.name
            $scope.UID = user.UID
            $scope.dbID = user._id
            $scope.department = user.department

        }
        $scope.updateUser = function (userID) {
            const request = {
                method: 'put',
                url: 'http://localhost:3000/api/db/' + userID,
                data: {
                    name: $scope.name,
                    UID: $scope.UID,
                    department: $scope.department,
                    _id: userID
                }
            }
            $http(request)
                .then(function (response) {
                    $scope.inputForm.$setPristine()
                    $scope.name = $scope.UID = $scope.department = ''
                    $scope.h2message = "Add user"
                    $scope.buttonMessage = "Add User"
                    $scope.getUsers()
                    $scope.dbID = null
                })

        }

        //DELETE (DELETE)
        $scope.deleteUser = function (_id) {

            const request = {
                method: 'delete',
                url: 'http://localhost:3000/api/db/' + _id,
            }
            $http(request)
                .then(function (response) {
                        $scope.inputForm.$setPristine()
                        $scope.name = $scope.UID = $scope.department = ''
                        $scope.getUsers()
                    }
                )
        }

      /*  $scope.getAuth = function () {
            const request = {
                method: 'get',
                url: 'http://localhost:3000/api/db/auth'
            }
            $http.request(request)
                .then(function (err, response) {
                    if (err) {
                        $scope.authorized = false
                    }

                    else {
                        $scope.authorized = true
                    }
                })

*/
        $scope.initApp = function () {
            $scope.mood = "0"
            $scope.moodWord = ""
            $scope.buttonState = "create"
            $scope.h2message = "Add user"
            $scope.buttonMessage = "Add User"
            $scope.authorized = false
            $scope.showLogin = false
            $scope.getUsers()
//            $scope.getAuth()
            //Grab cookies if present
            let authCookie = $cookies.get('authStatus')
            $scope.authorized = !!authCookie
        }

        $scope.logout = function () {
            $http.get('/auth/logout')
                .then(function (response) {
                    $scope.authorized = false
                })
        }
        $scope.login = function () {
            const request = {
                method: 'post',
                url: 'http://localhost:3000/auth/login',
                data: {
                    username: $scope.username,
                    password: $scope.password
                }
            }
            $http(request)
                .then(function (response) {
                        $scope.authorized = true
                        $scope.showLogin = false
                    },
                    function (err) {
                        $scope.authorized = false
                    }
                )
        }

        $scope.register = function () {

            const request = {
                method: 'post',
                url: '/auth/register',
                data: {
                    name: $scope.name,
                    username: $scope.username,
                    password: $scope.password
                }
            }
            $http(request)
                .then(function (response) {
                        $scope.authorized = true
                        $scope.showLogin = false
                    },
                    function (error) {
                        if (error.status === 401) {
                            $scope.authorized = false
                            $scope.h2message = "Error registering"
                            console.log(error)
                        }
                    }
                )
        }

        $scope.showLoginForm = function () {
            $scope.showLogin = true
        }

        $scope.doTwitterAuth = function () {
            var openUrl = '/auth/twitter/'
            //Total hack, this:
            $scope.authorized = true
            window.location.replace(openUrl)
        }

        //gets Trump tweets with Twitter API, puts in mongoose db, runs sentiment analysis with
        //Dandelion API, then prints result on homepage
        $scope.doSentimentAnalysis = function() {
            $http.get('api/fetch')
                .then(function (response) {
                    $scope.mood = (100 * response.data)
                })
        }

        $scope.getWord = function () {
            const request = {
                method: 'post',
                url: '/api/word',
                data: {
                    mood: $scope.mood,
                    username: $scope.username,
                    password: $scope.password
                }
            }
            $http(request)
                .then(function (response) {
                    $scope.moodWord = response.data
                })
        }

    })

    //Configure internal routes
    //
    .config(['$routeProvider', function ($routeProvider) {
        $routeProvider
            .when('/about', {
                templateUrl: 'components/about.html',
            })

            .when('/BU', {
                templateUrl: 'components/BU.html',
                controller: 'BUController'
            })

            .otherwise({
                redirectTo: '/'
            })
    }])

    .controller('authController', function ($scope, $location) {

        let authStatus = $location.search()
        console.log(authStatus)
        console.log('In authController')
        $scope.authorized = !!authStatus

    })
    .controller('BUController', function ($scope) {
$scope.message = "You MUSTgive money to the alumni fund!"
        }
    )


    //This controller handles toggling the display of details in the user list
    .controller('listController', function ($scope) {
        $scope.display = false

        $scope.showInfo = function () {
            $scope.display = !$scope.display
        }
    })
