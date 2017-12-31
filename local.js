var defaultHost = window.location.hostname;
var defaultPort = '4201';

var conn = null;

var login = document.getElementById('login');
var username = document.getElementById('username');
var password = document.getElementById('password');

var terminal = document.getElementById('terminal');
var output = MU.wrap(document.getElementById('output'));
var cmdprompt = MU.wrap(document.getElementById('prompt'));
var quicklinks = document.getElementById('quicklinks');
var entry = document.getElementById('entry');

var settingsContainer = document.getElementById('settings-container');
var settingsForm = document.getElementById('settings');
var fontSelect = document.getElementById('fontSelect');
var fontSize = document.getElementById('fontSize');
var fontBold = document.getElementById('fontBold');
var forceSSL = document.getElementById('forceSSL');
var keepAliveTime = document.getElementById('keepAliveTime');
var keepAliveLabel = document.getElementById('keepAliveLabel');

var infoContainer = document.getElementById('info-container');

var userinputContainer = document.getElementById('userinput-container');
var userinputForm = document.getElementById('userinput');
var commandContainer = document.getElementById('command-container');

var history = [];
var ncommand = 0;
var save_current = '';
var current = -1;
var eat_newline = 0;

/***********************************************/
/**  Body  **/

function startup() {
  settings.load();

  terminal.style.left = settings.SCREEN_LEFT + 'em';
  terminal.style.right = settings.SCREEN_RIGHT + 'em';

  terminal.style.top = settings.SCREEN_TOP + 'em';
  terminal.style.bottom = settings.SCREEN_BOT + 'em';

  if (username.value === '') {
    username.value = 'Username';
  }

  if (password.value === '') {
    password.value = 'Password';
  }

  settings.autoConnect.val && reconnect();

  keepalive();

  refocus();
};

function shutdown() {
  if (conn && conn.socket.readyState === 1) {
    conn.sendText('QUIT');
    setTimeout(conn.close, 1000);
  }

  conn = null;
};

/***********************************************/
/**  Callbacks  **/

login.onsubmit = function() {
  reconnect();

  return false;
};

terminal.onsubmit = function() {
  if (conn && conn.socket.readyState === 1) {
    if (entry.value !== '') {
      history[ncommand] = entry.value;
      ncommand++;
      save_current = '';
      current = -1;

      conn.sendText(entry.value);
      settings.localEcho.val && msg(entry.value);
    }
  } else {
    settings.autoReConnect.val && reconnect();
  }

  entry.value = '';

  entry.focus();

  return false;
};

output.onLine = Linkify.linkify;

entry.onkeydown = function(e) {
  var code = (e.keyCode ? e.keyCode : e.which);

  if ((code == 80 && e.ctrlKey)) {
  //if ((code == 38 && e.shiftKey) || (code == 80 && e.ctrlKey)) {
    // Up arrow || ctrl+p
    e.preventDefault();

    if (current < 0) {
      save_current = entry.value;
    }
    
    if (current < ncommand - 1) {
      current++;
      entry.value = history[ncommand-current-1];
    }
  } else if ((code == 78 && e.ctrlKey)) {
  //} else if ((code == 40 && e.shiftKey) || (code == 78 && e.ctrlKey)) {
    // Down arrow || ctrl+n
    if (current > 0) {
      current--;
      entry.value = history[ncommand-current-1];
    } else if (current === 0) {
      current = -1;
      entry.value = save_current;
    }
  } else if (code == 13) {
    // enter key
    e.preventDefault();

    if (settingsContainer.style.visibility === 'visible') {
      settings.save();
    } else if (userinputContainer.style.visibility === 'visible') {
      userinputContainer.style.visiblity = 'hidden';
    } else if (infoContainer.style.visibility === 'visible') {
      infoContainer.style.visibility = 'hidden';
    } else {
      // no overlay, submit text
      terminal.onsubmit();
    }

    entry.focus();
  } else if (code == 27) {
    toggle_overlay();
  }
};

entry.onkeyup = function(e) {
  var code = (e.keyCode ? e.keyCode : e.which);

  if ((code == 80 && e.ctrlKey)) {
  //if ((code == 38 && e.shiftKey) || (code == 80 && e.ctrlKey)) {
    // Move cursor to end of word after history change
    // only need for going up, since down arrow and ctrl+n move cursor already
    move_cursor_to_end(entry);
  }
};

settingsForm.onsubmit = function () {
  settings.save();

  entry.focus();

  return false;
};

settingsForm.onkeydown = function(e) {
  var code = (e.keyCode ? e.keyCode : e.which);

  if (code == 27) {
    // escape pressed, toggle form input and delete command elements
    toggle_overlay();
  }

};

forceSSL.onchange = function() {
  if (forceSSL.checked) {
    serverPort.value = parseInt(serverPort.value) + 1;
  } else {
    serverPort.value = parseInt(serverPort.value) - 1;
  }
};

userinputForm.onsubmit = function () {
  
  var cmd = userinput.get();

  conn && conn.sendText(cmd);
  settings.localEcho.val && msg(cmd);
    
  toggle_overlay();
};

userinputForm.onkeydown = function (e) {
  var code = (e.keyCode ? e.keyCode : e.which);

  if (code == 27) {
    // escape pressed, toggle form input and delete command elements
    toggle_overlay();
  }
};

infoContainer.onkeydown = function(e) {
  var code = (e.keyCode ? e.keyCode : e.which);

  toggle_overlay();
};

/***********************************************/
/**  Focus  **/

function refocus() {
  if (((window.getSelection == "undefined") ||
       (window.getSelection() == "")) &&
      ((document.getSelection == "undefined") ||
       (document.getSelection() == "")) &&
     !((document.activeElement.tagName === "INPUT") &&
       (document.activeElement.type.search(/image/gi) === -1)))
  {
    entry.focus();
  }
};

function move_cursor_to_end(el) {
  if (typeof el.selectionStart == "number") {
      el.selectionStart = el.selectionEnd = el.value.length;
  } else if (typeof el.createTextRange != "undefined") {
      el.focus();
      var range = el.createTextRange();
      range.collapse(false);
      range.select();
  }
};

function toggle_overlay() {
  if (settingsContainer.style.visibility === 'visible') {
    settings.show();
    settings.reconfigure();
  } else if (userinputContainer.style.visibility === 'visible') {
    userinputContainer.style.visiblity = 'hidden';
  } else if (infoContainer.style.visibility === 'visible') {
    infoContainer.style.visibility = 'hidden';
  } else {
    // no overlay, bring up settings
    settings.show();
  }

  entry.focus();
};

/***********************************************/
/**  Terminal  **/

function msg(data) {
  var text = document.createElement('div');
  text.className = "logMessage";
  text.innerHTML = data;
  output.appendHTML(text);
};

function xch_cmd(command) {
  var cmd = command;
  var regex = /\?\?/;
  
  if (cmd.search(regex) !== -1) {
    var val = prompt(command);
    
    if (val && val != 'undefined') {
      cmd = cmd.replace(regex, val);
    } else {
      cmd = cmd.replace(regex, '');
    }
  }

  conn && conn.sendText(cmd);
  settings.localEcho.val && msg(cmd);
};

function clearscreen (which) {
  document.getElementById(which).innerHTML = '';
};

function keepalive () {
  conn && settings.keepAlive.val && conn.sendText("IDLE");
  setTimeout(keepalive, settings.keepAliveTime.val*1000.0);
};

function reconnect() {
  if (!window.WebSocket){
    window.location.replace("/505.htm");
  }

  entry.focus();

  if (conn) {
    var old = conn;
    old.sendText('QUIT');
    setTimeout(function () { old.close(); }, 1000);
    conn = null;
  }

  msg('%% Reconnecting to server...\r\n');

  var proto = ((window.location.protocol == "https:") || settings.forceSSL.val) ? 'wss://' : 'ws://';

  conn = MU.open(proto + settings.serverAddress.val + ":" + settings.serverPort.val + '/wsclient');
  
  conn.onOpen = function (text) {
    msg("%% Connected.");
    if (username.value.toUpperCase() !== "USERNAME" && username.value !== "") {
      setTimeout(function () {
        conn.sendText('connect "' + username.value + '" ' + password.value);
      }, 4000);
    }
  };

  conn.onError = function (evt) {
    msg("%% Connection error!");
    console.log('error', evt);
  };

  conn.onClose = function (evt) {
    msg("%% Connection closed.");
    console.log('close', evt);
  };

  conn.onText = function (text) {
    var reg = /^FugueEdit > /;
    if (text.search(reg) !== -1) {
      entry.value = text.replace(reg, "");
    } else {
      output.appendText(text);
    }
  };
  
  conn.onObject = function (obj) {
    console.log('object', obj);
  };
  
  conn.onHTML = function (fragment) {
    output.appendHTML(fragment);
  };
  
  conn.onPueblo = function (tag, attrs) {
    var html = '<' + tag + (attrs ? ' ' : '') + attrs + '>';

    var start;
    if (tag[0] !== '/') {
      start = true;
    } else {
      start = false;
      tag = tag.substring(1);
    }

    if ((tag === 'XCH_PAGE') || 
        ((tag === 'IMG') && (attrs.search(/xch_graph=(("[^"]*")|('[^']*')|([^\s]*))/i) !== -1)) ||
        (tag === 'HR')) {
      console.log("unhandled pueblo", html);
      return;
    }


    if (start) {
      var div = document.createElement('div');

      html = html.replace(
        /xch_graph=(("[^"]*")|('[^']*')|([^\s]*))/i,
        ''
      );

      html = html.replace(
        /xch_mode=(("[^"]*")|('[^']*')|([^\s]*))/i,
        ''
      );

      html = html.replace(
        /xch_hint="([^"]*)"/i,
        'title="$1"'
      );

      div.innerHTML = html.replace(
        /xch_cmd="([^"]*)"/i,
        "onClick='xch_cmd(&quot;$1&quot;)'"
      );

      div.setAttribute('target', '_blank');

      output.pushElement(div.firstChild);
    } else {
      output.popElement();
    }
  };

  conn.onPrompt = function (text) {
    cmdprompt.innerHTML = '';
    cmdprompt.appendText(text + '\r\n');
  };
};

/***********************************************/
/**  User Input  **/

var UserInputPrompt = (function (window, document, undefined) {
  this.cmdstring = '';
  this.hintstring = '';
  
  this.show = function (command, hint) {
    var regex = /\?\?/;
    var cmd = command.split(regex);

    // build command prompt
    for (var i=0; i < cmd.length-1; i++)
    {
      var div = commandContainer.createElement('div');
      div.innerHtml(cmd[i]);
      
      var input = commandContainer.createElement('input');
    }

    userinputContainer.style.visibility = 'visible';
  };

  this.cancel = function () {

  };

  this.get = function () {

  };
});

var userinput = new UserInputPrompt(window,document,undefined);

/***********************************************/
/**  Settings  **/

var SettingsClass = (function (window, document, undefined) {

  this.localEcho = {val: true};
  this.autoConnect = {val: true};
  this.autoReConnect = {val: true};
  this.numInputLines = {val: 3};
  this.serverAddress = {val: defaultHost};
  this.serverPort = {val: defaultPort};
  this.forceSSL = {val: false};
  this.keepAlive = {val: true};
  this.keepAliveTime = {val: 600};
  this.fontSelect = {val: "Courier New"};
  this.fontSize = {val: 10};
  this.fontBold = {val: false};

  this.SCREEN_TOP = 3;
  this.SCREEN_BOT = 3;
  this.SCREEN_LEFT = 3;
  this.SCREEN_RIGHT = 3;

  this.doc = document;
  
  settingsContainer.style.visibility = 'hidden';
  
  /////////////////////////////////////

  this.updateFonts = function() {
    document.body.style.fontFamily = fontSelect.value + ", 'Courier New', monospace";
    document.body.style.fontSize = fontSize.value + 'pt';
    document.body.style.fontWeight = (fontBold.checked ? "bold" : "normal");;
    keepAliveLabel.innerHTML='KeepAlive('+keepAliveTime.value+'s)';
  };

  this.show = function () {
    if (settingsContainer.style.visibility === 'visible') {
      settingsContainer.style.visibility = 'hidden';
      this.reconfigure();
    } else {
      // restore form values from actual settings
      var opts = document.getElementsByClassName('option');
      for (var i=0; i < opts.length; i++)
      {
        var opt = this[opts[i].id];
        if (opt) {
          if (opts[i].type.toUpperCase() === 'CHECKBOX') {
            opts[i].checked = opt.val;
          } else {
            opts[i].value = opt.val;
          }
        }
        
      }
      settingsContainer.style.visibility = 'visible';
    }
  };

  this.cookie = function (c_name) {
    var c_value = this.doc.cookie;
    var c_start = c_value.indexOf(" " + c_name + "=");

    if (c_start == -1)
    {
      c_start = c_value.indexOf(c_name + "=");
    }

    if (c_start == -1) {
      c_value = null;
    } else {
      c_start = c_value.indexOf("=", c_start) + 1;

      var c_end = c_value.indexOf(";", c_start);
    
      if (c_end == -1) {
        c_end = c_value.length;
      }
    
      c_value = unescape(c_value.substring(c_start,c_end));
    }
  
    return c_value;
  };

  // Load values from cookies, or save the cookie on first visitl
  this.load = function () {
    var opts = document.getElementsByClassName('option');
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + 365*10);
    
    for (var i = 0; i < opts.length; i++)
    {
      var opt = this[opts[i].id];
      
      if (opt) {
        if (opts[i].type.toUpperCase() === 'CHECKBOX') {
          var val = this.cookie(opts[i].id);
          if (val && val != 'undefined') {
            opt.val = (val.toUpperCase() === 'TRUE');
          } else {
            this.doc.cookie = opts[i].id + "=" + opt.val
          }
          
          opts[i].checked = opt.val;
        } else {
          var val = this.cookie(opts[i].id);
          if (val && val != 'undefined') {
            opt.val = val;
          } else {
            this.doc.cookie = opts[i].id + "=" + opt.val
          }
          
          opts[i].value = opt.val;
        }
      }
    }
    
    this.reconfigure();
  };
  
  // Save form values to settings values, and settings values to cookies
  this.save = function () {
    var opts = document.getElementsByClassName('option');
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + 365*10);
    
    for (var i = 0; i < opts.length; i++)
    {
      var opt = this[opts[i].id];
      
      // copy form values to settings values
      if (opt) {
        if (opts[i].type.toUpperCase() === 'CHECKBOX') {
          if (opts[i].checked !== opt.val) {
            opt.val = opts[i].checked;
          }
        } else {
          if (opts[i].value !== opt.val) {
            opt.val = opts[i].value;
          }
        }
        
        // save settings value to cookie
        this.doc.cookie=opts[i].id + "=" + opt.val + "; expires="+exdate.toUTCString();
      }
    }
    
    this.reconfigure();
    
    // toggle visibility
    settingsContainer.style.visibility = 'hidden';
  };

  // Resize or otherwise modify the output window to reflect the new settings
  this.reconfigure = function() {
    document.body.style.fontFamily = this.fontSelect.val + ", 'Courier New', monospace";
    document.body.style.fontSize = this.fontSize.val + 'pt';
    document.body.style.fontWeight = (this.fontBold.val ? "bold" : "normal");;
    output.root.style.bottom = 4.0+parseInt(this.numInputLines.val) + 'em';
    quicklinks.style.bottom = 2.0+parseInt(this.numInputLines.val) + 'em';
    cmdprompt.root.style.bottom = 1.0+parseInt(this.numInputLines.val) + 'em';
    entry.style.height = parseInt(this.numInputLines.val) + 'em';
    keepAliveLabel.innerHTML='KeepAlive('+keepAliveTime.value+'s)';
  };

});

var settings = new SettingsClass(window,document,undefined);
