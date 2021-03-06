/**
 * Piwik - Open source web analytics
 *
 * @link http://piwik.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html Gpl v3 or later
 */

var url = require('url');

function appendIndexPhpIfNecessary(accessUrl)
{
    if (!accessUrl) {
        return '';
    }

    accessUrl = appendSlashIfNecessary(accessUrl);
    
    if (!url.endsWithPhp(accessUrl)) {
        accessUrl = accessUrl + 'index.php';
    }

    return accessUrl;
}

function appendSlashIfNecessary(accessUrl)
{
    if (!accessUrl) {
        return '';
    }

    if (!url.endsWithSlash(accessUrl) && !url.endsWithPhp(accessUrl)) {
        accessUrl = accessUrl + '/';
    } 

    return accessUrl;
}

var Alloy = require('alloy');

exports.definition = {

    config: {
        "columns": {
            "accessUrl":"string",
            "username":"string",
            "tokenAuth":"string",
            "name":"string",
            "active":"boolean",
            "createVersionNumber":"string",
            "changeVersionNumber":"string",
            "version":"string",
            "dateVersionUpdated":"string",
            "defaultReport": "string",
            "defaultReportDate": "string"
        },
        "adapter": {
            "type": "properties",
            "collection_name": "appaccounts"
        },
        lastUsedAccountPropertyKey: "app_account_id_last_used",
        defaults: {
            active: true,
            createVersionNumber: Ti.App.version,
            changeVersionNumber: Ti.App.version,
            defaultReport: Alloy.CFG.account.defaultReport,
            defaultReportDate: Alloy.CFG.account.defaultReportDate
        }
    },      

    extendModel: function(Model) {      
        _.extend(Model.prototype, {
            
            initialize: function () {
                this.on('change:accessUrl', this.completeAccessUrl);
            },

            startWithAllWebsitesDashboard: function () {
                return 'MultiSites' === this.get('defaultReport');
            },

            getAuthToken: function () {
                return this.get('tokenAuth');
            },

            entrySiteId: function () {
                return this.get('defaultReport');
            },

            syncPreferences: function () {

            },

            getUsername: function () {
                return this.get('username');
            },

            getPassword: function () {
                return this.get('password');
            },

            getName: function () {
                return this.get('name');
            },

            getDefaultReportDate: function () {
                return this.get('defaultReportDate');
            },

            isSameAccount: function (account) {
                return (account && this.get('id') == account.get('id'));
            },
            
            completeAccessUrl: function (accountModel, accessUrl) {
                
                if (!accessUrl || !accountModel) {
                    console.info('Unable to complete access url, missing account or url', 'appaccounts');
                    return;
                }

                accessUrl = appendIndexPhpIfNecessary(accessUrl);
                
                accountModel.set({accessUrl: accessUrl}, {silent: true});
            },
            
            validate: function (attrs) {

                if (!attrs) {
                    return 'Unknown';
                }
                
                if (attrs.username && !attrs.password) {
                    return 'MissingPassword';

                } else if (!attrs.username && attrs.password) {
                    return 'MissingUsername';
                }
                
                var accessUrl = attrs.accessUrl;

                if (!accessUrl || !url.startsWithHttp(accessUrl)) {

                    return 'InvalidUrl';
                }
            },

            resetPiwikVersion: function () {
                
                this.set({version: '', dateVersionUpdated: ''});
                
                return this;
            },

            select: function (callback) {

                this.markAccountAsLastUsed();
                this.updatePreferences(callback);
                this.updatePiwikVersion();
            },

            markAccountAsLastUsed: function () {
                var lastUsedAccountKey = this.config.lastUsedAccountPropertyKey;
                var accountId = parseInt(this.id, 10);

                if (accountId) {
                    Ti.App.Properties.setInt(lastUsedAccountKey, accountId);
                }
            },

            updatePreferences: function (callback) {

                if ('anonymous' == this.get('tokenAuth')) {
                    callback(this);
                    callback = null;

                    return;
                }

                var preferences = Alloy.createCollection('piwikAccountPreferences');

                var onSuccess = function (account, defaultReport, defaultReportDate) {

                    account.set('defaultReport', defaultReport);
                    account.set('defaultReportDate', defaultReportDate);

                    callback(account);
                    callback = null;
                };

                var onError = function (account) {
                    callback(account);
                    callback = null;
                };

                preferences.fetchPreferences(this, onSuccess, onError);
            },

            updatePiwikVersion: function() {

                var that    = this;
                var account = this;

                var version = Alloy.createModel('piwikVersion');
                version.fetch({
                    account: this,
                    success : function(model) {

                        that.set({dateVersionUpdated: (new Date()) + ''});

                        if (model && model.getVersion()) {
                            that.set({version: '' + model.getVersion()});
                        } else if (!account.version) {
                            that.set({version: ''});
                        } else {
                            // there went something wrong with the request. For example the network connection broke up.
                            // do not set account version to 0 in such a case. We would overwrite an existing version, eg 183
                        }
                        
                        that.save();
                        that    = null;
                        account = null;
                    },
                    error : function(model, resp) {
                        // just ignore, piwik installation is too old
                    }
                });
            },
            
            getBasePath: function () {
                var accessUrl = this.get('accessUrl');
            
                if (!accessUrl) {
            
                    return '';
                }
                
                accessUrl = accessUrl + '';

                if (url.endsWithPhp(accessUrl)) {
                    return url.getAbsolutePath(accessUrl);
                }
            
                accessUrl = appendSlashIfNecessary(accessUrl);
            
                return accessUrl;
            },

            updateAuthToken: function () {
                var username = this.get('username');
                var password = this.get('password');
                var account  = this;

                var onSuccess = function (model) {
                    if (model && model.getTokenAuth()) {
                        account.set({tokenAuth: model.getTokenAuth()});
                    }
                };

                var onError = function (model) {
                    return account.trigger('error', account, 'ReceiveAuthTokenError');
                };

                var tokenAuth = Alloy.createModel('piwikTokenAuth');
                tokenAuth.fetchToken(this, username, password, onSuccess, onError);
            }

        }); // end extend
        
        return Model;
    },
    
    
    extendCollection: function(Collection) {
        _.extend(Collection.prototype, {

            hasAccount: function () {
                return !!this.length;
            },

            lastUsedAccount: function () {
                var lastUsedAccountKey = this.config.lastUsedAccountPropertyKey;
                var hasAccountProperty = Ti.App.Properties.hasProperty(lastUsedAccountKey);

                if (!hasAccountProperty) {

                    return this.first();
                }

                var lastUsedAccountId = Ti.App.Properties.getInt(lastUsedAccountKey);
                var lastUsedAccount   = this.get(lastUsedAccountId);

                if (!lastUsedAccount) {

                    return this.first();
                }

                return lastUsedAccount;

            }

            
        }); // end extend
        
        return Collection;
    }
        
};

