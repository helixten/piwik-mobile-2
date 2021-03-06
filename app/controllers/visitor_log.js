/**
 * Piwik - Open source web analytics
 *
 * @link http://piwik.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html Gpl v3 or later
 */

function L(key)
{
    return require('L')(key);
}

var accountModel = require('session').getAccount();
var siteModel    = require('session').getWebsite();
var reportDate   = require('session').getReportDate();
var visitorLog   = Alloy.createCollection('piwikLastVisitDetails');
visitorLog.on('reset', render);
visitorLog.on('error', onFetchError);

if (OS_IOS) {
    $.pullToRefresh.init($.visitorLogTable);
}

function registerEvents()
{
    var session = require('session');
    session.on('websiteChanged', onWebsiteChanged);
    session.on('reportDateChanged', onDateChanged);
}

function unregisterEvents()
{
    var session = require('session');
    session.off('websiteChanged', onWebsiteChanged);
    session.off('reportDateChanged', onDateChanged);
}

function openVisitor(event)
{
    if (!event || !event.row || !event.row.visitor) {
        return;
    }

    var params  = {visitor: event.row.visitor};
    var visitor = Alloy.createController('visitor', params);
    visitor.open();
}

function onWebsiteChanged(website)
{
    require('Piwik/Tracker').trackEvent({title: 'Website Changed', url: '/visitor-log/change/website'});

    siteModel    = website;
    accountModel = require('session').getAccount();
    doRefresh();
}

function onDateChanged(date)
{
    if (!date) {
        return;
    }

    require('Piwik/Tracker').trackEvent({title: 'Date Changed', url: '/visitor-log/change/date'});

    reportDate = date;
    doRefresh();
}

function trackWindowRequest()
{
    require('Piwik/Tracker').trackWindow('Visitor Log', 'visitor-log');
}

function onOpen()
{
    trackWindowRequest();
}

function onClose()
{
    unregisterEvents();
    $.destroy();
    $.off();
}

function fetchPrevious()
{
    showLoadingMessage();
    visitorLog.previous(accountModel, siteModel.id);

    require('Piwik/Tracker').trackEvent({title: 'Previous Visitors', url: '/visitor-log/previous'});
}

function fetchNext()
{
    showLoadingMessage();
    visitorLog.next(accountModel, siteModel.id);

    require('Piwik/Tracker').trackEvent({title: 'Next Visitors', url: '/visitor-log/next'});
}

function render()
{
    showReportContent();

    var rows = [];

    var nextRow = {title: L('General_Next'), color: '#336699'};
    if (OS_MOBILEWEB) nextRow.left = 10;
    if (OS_ANDROID) {
        nextRow.leftImage = '/spacer_16x16.png';
        nextRow.font   = {fontSize: '15sp', fontWeight: 'bold'};
        nextRow.top    = '12dp';
        nextRow.bottom = '12dp';
    }

    var row = Ti.UI.createTableViewRow(nextRow);
    row.addEventListener('click', fetchNext);
    rows.push(row);

    if (visitorLog && visitorLog.length) {
        visitorLog.forEach(function (visitorDetail) {
            if (!visitorDetail) {
                return;
            }

            var params = {account: accountModel, visitor: visitorDetail.attributes};
            var visitorOverview = Alloy.createController('visitor_overview', params);
            var visitorRow      = visitorOverview.getView();
            visitorRow.visitor  = visitorDetail.attributes;
            rows.push(visitorRow);
            visitorRow = null;
        });
    } else {
        var row = Ti.UI.createTableViewRow({title: L('Mobile_NoVisitorsShort')});
        rows.push(row);
    }

    var prevRow = {title: L('General_Previous'), color: '#336699'};
    if (OS_MOBILEWEB) prevRow.left = 10;
    if (OS_ANDROID) {
        prevRow.leftImage = '/spacer_16x16.png';
        prevRow.font   = {fontSize: '15sp', fontWeight: 'bold'};
        prevRow.left   = '16dp';
        prevRow.top    = '12dp';
        prevRow.bottom = '12dp';
    }

    var row = Ti.UI.createTableViewRow(prevRow);
    row.addEventListener('click', fetchPrevious);
    rows.push(row);

    $.visitorLogTable.setData(rows);

    if (OS_IOS && $.visitorLogTable && $.visitorLogTable.scrollToTop) {
        $.visitorLogTable.scrollToTop();
    }

    rows = null;
}

function showReportContent()
{
    if (OS_IOS) {
        $.pullToRefresh.refreshDone();
    } 

    $.content.show();
    $.loadingIndicator.hide();
    $.nodata.hide();
}

function showLoadingMessage()
{
    if (OS_IOS) {
        $.pullToRefresh.refresh();
    } 

    $.loadingIndicator.show();
    $.content.hide();
    $.nodata.hide();
}

function showReportHasNoVisitors(title, message)
{
    $.nodata.show({title: title, message: message});
    $.content.hide();
    $.loadingIndicator.hide();
}

function onFetchError(undefined, error)
{
    if (error) {
        showReportHasNoVisitors(error.getError(), error.getMessage());
    }
}

function doRefresh()
{
    if (!accountModel || !siteModel) {
        console.log('account or site not found, cannot refresh visitor log');
        return;
    }

    showLoadingMessage();

    // TODO fallback to day/today is not a good solution cause user won't notice we've fallen back to a different date
    var piwikPeriod = reportDate ? reportDate.getPeriodQueryString() : 'day';
    var piwikDate   = reportDate ? reportDate.getDateQueryString() : 'today';

    visitorLog.initial(accountModel, siteModel.id, piwikPeriod, piwikDate);
}

function toggleReportConfiguratorVisibility()
{
    require('report/configurator').toggleVisibility();

    require('Piwik/Tracker').trackEvent({title: 'Toggle Report Configurator', url: '/visitor-log/toggle/report-configurator'});
}

function toggleReportChooserVisibility()
{
    require('report/chooser').toggleVisibility();

    require('Piwik/Tracker').trackEvent({title: 'Toggle Report Chooser', url: '/visitor-log/toggle/report-chooser'});
}

exports.open = function () 
{
    registerEvents();
    doRefresh();
    require('layout').open($.index);
};

function close()
{
    require('layout').close($.index);
}

exports.close   = close;
exports.refresh = doRefresh;