/**
 * @OnlyCurrentDoc  Limits the script to only accessing the current spreadsheet.
 */

var SIDEBAR_TITLE = 'Highlight Explorer';

/**
 * Adds a custom menu with items to show the sidebar and dialog.
 *
 * @param {Object} e The event parameter for a simple onOpen trigger.
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
      .createAddonMenu()
      .addItem('Start', 'showSidebar')
      .addItem('Reset', 'reset')
      .addToUi();
}

/**
 * Runs when the add-on is installed; calls onOpen() to ensure menu creation and
 * any other initializion work is done immediately.
 *
 * @param {Object} e The event parameter for a simple onInstall trigger.
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Opens a sidebar. The sidebar structure is described in the Sidebar.html
 * project file.
 */
function showSidebar() {
  var ui = HtmlService.createTemplateFromFile('Sidebar')
      .evaluate()
      .setTitle(SIDEBAR_TITLE)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showSidebar(ui);
}

/**
 * Handle text/audio requests from user.
 * @param {String|Audio} from user
 * @param {String} type of request
 * @param {String} lang of request
 * @return {object} JSON-formatted intent response
 */
function handleCommand(input, type, lang){
  var intent = detectMessageIntent(input, type, lang);
  
  console.log({call:'detectMessageIntent', data:intent});
  // if not all required parameters return the intent to continue the conversation
  if (!("allRequiredParamsPresent" in intent.queryResult)){
    return intent;
  }
  try {
    var param = intent.queryResult.parameters;
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getActiveSheet();
    var dataRange = sheet.getDataRange();
    
    var values = dataRange.getValues();
    var colors = dataRange.getBackgrounds();
    var count = 0;
    var colIdx = convertCol(param.column);
    var range = param.range || 'cells';
    var color = param.color || 'red'; 
    color = color.replace(/\s/g, "");
    var value = param.number;
    var operator = param.operator;
    
    // setup functions to handle action operators
    if (range === 'cells'){
      var highlightOp = 'colors[r][colIdx] = color;';
    } else {
      var highlightOp = 'for (var c=0; c < row.length; c++){ colors[r][c] = color; }';
    }
    var highlightFn = new Function('colors', 'color', 'row', 'colIdx', 'r', 'if (row[colIdx] '+operator+value+'){'+highlightOp+'}');
    
    // loop over data range and apply highlights
    for (var r=0; r<values.length; r++){
      var row = values[r];
      highlightFn(colors, color, row, colIdx, r);
    }  
    dataRange.setBackgrounds(colors);
    return intent;
  } catch(e) {
    return intent;
  }
}

/**
 * Detect message intent from Dialogflow Agent.
 * @param {String|Audio} input from user 
 * @param {String} type of input
 * @return {object} JSON-formatted response
 */
function detectMessageIntent(input, type, lang){
  
  // setting up calls to Dialogflow with Goa
  var goa = cGoa.GoaApp.createGoa ('dialogflow_serviceaccount',
                                   PropertiesService.getScriptProperties()).execute ();
  if (!goa.hasToken()) {
    throw 'something went wrong with goa - no token for calls';
  }
  
  // set our token 
  Dialogflow.setTokenService(function(){ return goa.getToken(); } );
  
  var PROJECT_ID = goa.getProperty("project_id"); 
   
  /* Preparing the Dialogflow.projects.agent.sessions.detectIntent call 
   * https://cloud.google.com/dialogflow-enterprise/docs/reference/rest/v2/projects.agent.sessions/detectIntent
  */
  var requestResource = {
    "queryInput": { },
    "queryParams": {
      "timeZone": Session.getScriptTimeZone() // using script timezone but you may want to handle as a user setting
    }
  };
  
  if (type === 'text'){
    requestResource.queryInput.text = {"text": input,
                                       "languageCode": lang };
  } else if(type === 'audio') {
    requestResource.queryInput.audioConfig= {"audioEncoding": 'AUDIO_ENCODING_LINEAR_16',
                                             "languageCode": lang };
    requestResource.inputAudio = extractBase64_(input);
  } else {
    throw('Unsupported type');
  }
  // using an URI encoded ActiveUserKey (non identifiable) https://developers.google.com/apps-script/reference/base/session#getTemporaryActiveUserKey()
  var SESSION_ID = encodeURIComponent(Session.getTemporaryActiveUserKey()); 
   
  var session = 'projects/'+PROJECT_ID+'/agent/sessions/'+SESSION_ID; // 
  var options = {};
  var intent = Dialogflow.projectsAgentSessionsDetectIntent(session, requestResource, options);
  return intent;
}

/**
 * Extract base64 string
 * @param {String} dataURI from client
 * @return {String} baseString
 */
function extractBase64_(dataURI) {
  var baseString;
  if (dataURI.split(',')[0].indexOf('base64') >= 0){
    baseString = dataURI.split(',')[1]
  } else {
    baseString = dataURI;
  }
  return baseString;
}

/**
 * Reset highlights
 */
function reset(){
  // https://stackoverflow.com/a/34350279/1027723
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getActiveSheet();
  var dataRange = sheet.getDataRange();
  dataRange.setBackground(null);
}

/**
 * Convert a column letter to column index
 * @return {Integer} column  index
 */
function convertCol(val) {
  if (!val){
    return false;
  }
  val = val.toUpperCase();
  var base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', i, j, result = 0;

  for (i = 0, j = val.length - 1; i < val.length; i += 1, j -= 1) {
    result += Math.pow(base.length, j) * (base.indexOf(val[i]) + 1);
  }

  return result-1;
}

