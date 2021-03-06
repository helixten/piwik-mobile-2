/**
 * Piwik - Open source web analytics
 *
 * @link http://piwik.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html Gpl v3 or later
 */

var onSiteSelectedCallback = null;

function openEntrySite(account) 
{
    if (!account) {
        console.warn('Cannot open entry site, no account given', 'account');
        return;
    }

    var entrySiteId = account.entrySiteId();
    var site        = Alloy.createCollection('PiwikWebsitesById');
    site.fetch({
        params: {idSite: entrySiteId},
        account: account,
        success: function (sites) {
            if (!sites) {
                console.warn('Failed to fetch entry site', 'account');
                return;
            }

            onSiteSelected({site: sites.entrySite(), account: account});
            account = null;
        },
        error: function (undefined, error) {
            if (error && error.getError) {

               var L      = require('L');
               var dialog = Ti.UI.createAlertDialog({title: error.getError(), message: error.getMessage(), buttonNames: [L('Mobile_Refresh')]});
               dialog.addEventListener('click', function () { openEntrySite(account);account = null; });
               dialog.show();
               dialog = null;

            }
        }
    });
}

function onSiteSelected(event)
{
    if (!event || !onSiteSelectedCallback) {
        console.log('cannot select site', 'account');
        return;
    }

    onSiteSelectedCallback(event.site, event.account);
}

function openDashboard(account)
{
    var dashboard = Alloy.createController('all_websites_dashboard');
    dashboard.on('websiteChosen', onSiteSelected);
    dashboard.on('websiteChosen', function () {
        this.close();
    });

    dashboard.open();
}

function updateDefaultReportDateInSession(accountModel)
{
    if (!accountModel) {
        console.warn('Cannot update default report date in session, no account', 'account');
        return;
    }

    var reportDate = new (require('report/date'));
    reportDate.setReportDate(accountModel.getDefaultReportDate());

    require('session').setReportDate(reportDate);
}

exports.selectWebsite = function (accountModel, callback)
{
    if (!accountModel) {
        console.log('Cannot select website, no account given', 'account');
        return;
    }

    onSiteSelectedCallback = callback;

    accountModel.select(function (account) {
        updateDefaultReportDateInSession(account);
        if (account.startWithAllWebsitesDashboard()) {
            openDashboard(account);
        } else {
            openEntrySite(account);
        }
    });
};