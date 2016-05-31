/*
 * angular-google-picker
 *
 * Interact with the Google API Picker
 * More information about the Google API can be found at https://developers.google.com/picker/
 *
 * (c) 2014 Loic Kartono
 * License: MIT
 */
(function () {
  angular.module('lk-google-picker', [])

  .provider('lkGoogleSettings', function () {
    this.apiKey   = null;
    this.clientId = null;
    this.developerKey = null;
    this.scopes   = ['https://www.googleapis.com/auth/drive'];
    this.features = ['MULTISELECT_ENABLED'];
    this.views    = [
      'DocsView().setIncludeFolders(true)',
      'DocsUploadView().setIncludeFolders(true)'
    ];
    this.locale   = 'en'; // Default to English

    /**
     * Provider factory $get method
     * Return Google Picker API settings
     */
    this.$get = ['$window', function ($window) {
      return {
        apiKey       : this.apiKey,
        clientId     : this.clientId,
        developerKey : this.developerKey,
        scopes       : this.scopes,
        features     : this.features,
        views        : this.views,
        locale       : this.locale,
        origin       : this.origin || $window.location.protocol + '//' + $window.location.host
      }
    }];

    /**
     * Set the API config params using a hash
     */
    this.configure = function (config) {
      for (var key in config) {
        this[key] = config[key];
      }
    };
  })

  .directive('lkGooglePicker', ['lkGoogleSettings', function (lkGoogleSettings) {
    return {
      restrict: 'A',
      scope: {
        onLoaded: '&',
        onCancel: '&',
        onPicked: '&',
        accessToken: '@'
      },
      link: function (scope, element, attrs) {
        var accessToken = null;

        /**
         * Load required modules
         */
        function instanciate () {
          if (!scope.accessToken) {
            gapi.load('auth', { 'callback': onApiAuthLoad });
          } else if (scope.accessToken && lkGoogleSettings.developerKey) {
            onApiAuthLoad();
          } else {
            throw "You need a developerKey in the configuration to use the accessToken directive";
          }
          gapi.load('picker');
        }

        /**
         * OAuth autorization
         * If user is already logged in, then open the Picker modal
         */
        function onApiAuthLoad () {
          if (!scope.accessToken) {
            var authToken = gapi.auth.getToken();
          } else {
            var authToken = {};
            authToken.access_token = scope.accessToken;
          }

          if (authToken) {
            handleAuthResult(authToken);
          } else {
            gapi.auth.authorize({
              'client_id' : lkGoogleSettings.clientId,
              'scope'     : lkGoogleSettings.scopes,
              'immediate' : false
            }, handleAuthResult);
          }
        }

        /**
         * Google API OAuth response
         */
        function handleAuthResult (result) {
          if (result && !result.error) {
            accessToken = result.access_token;
            openDialog();
          }
        }

        /**
         * Everything is good, open the files picker
         */
        function openDialog () {
          var picker = new google.picker.PickerBuilder()
                                 .setLocale(lkGoogleSettings.locale)
                                 .setOAuthToken(accessToken)
                                 .setCallback(pickerResponse)
                                 .setOrigin(lkGoogleSettings.origin);

          if (lkGoogleSettings.developerKey) {
            console.log(lkGoogleSettings.developerKey);
            console.log(accessToken);
            picker.setDeveloperKey(lkGoogleSettings.developerKey);
          }

          if (lkGoogleSettings.features.length > 0) {
            angular.forEach(lkGoogleSettings.features, function (feature, key) {
              picker.enableFeature(google.picker.Feature[feature]);
            });
          }

          if (lkGoogleSettings.views.length > 0) {
            angular.forEach(lkGoogleSettings.views, function (view, key) {
              view = eval('new google.picker.' + view);
              picker.addView(view);
            });
          }

          picker.build().setVisible(true);
        }

        /**
         * Callback invoked when interacting with the Picker
         * data: Object returned by the API
         */
        function pickerResponse (data) {
          gapi.client.load('drive', 'v2', function () {
            if (data.action == google.picker.Action.LOADED && scope.onLoaded) {
              (scope.onLoaded || angular.noop)();
            }
            if (data.action == google.picker.Action.CANCEL && scope.onCancel) {
              (scope.onCancel || angular.noop)();
            }
            if (data.action == google.picker.Action.PICKED && scope.onPicked) {
              (scope.onPicked || angular.noop)({docs: data.docs});
            }
            scope.$apply();
          });
        }

        gapi.load('auth');
        gapi.load('picker');

        element.bind('click', function (e) {
          instanciate();
        });
      }
    }
  }]);
})();
