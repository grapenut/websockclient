# WebSockClient (WSClient)

wsclient.js provides the WSClient object which has 2 exports: WSClient.open() and WSClient.emulate(). It is responsible for the websocket connection and terminal emulation of color escape codes.

index.html, style.css and local.js are a simple implementation of a client that provides an example of text, pueblo, and html handlers. These handlers are passed data (text string, html string, pueblo tags/attrs) and are responsible for appending that data to the terminal element in the browser. Terminal emulation must be enabled on the terminal output element before it can properly emulate ANSI color codes.

# Terminal Emulation
WSClient.emulate(terminal) enables terminal emulation on the body of DOM element "terminal" (usually a div).

There are a few functions provided to terminal now.

terminal.appendText(text) appends "text" to the terminal, parsing any color escape codes into HTML/CSS.
terminal.appendHTML(html) appends "html" as a code fragment to the end of the terminal.

# Websocket Connection
connection = WSClient.open(url) returns a connection object. The "url" is of the form ws://host:port/wsclient or wss://host:port/wsclient. 

connection.sendText(text) sends the command "text" to the MUSH.

# Connection Events
Overload events on the connection object in order to handle data.

connection.onOpen(evt) can be overloaded to automatically send the connect command with username/password (e.g. from an input box).

connection.onText(text) handles incoming plain text. Use terminal.appendText(text) to parse escape codes and append it to the terminal element's output.

connection.onHTML(html) handles incoming HTML code. Use terminal.appendHTML(html) to append the html code to the end of the terminal element's output.

connection.onObject(object) handles an incoming JSON object. There is no default implementation, but one could use this to pass any manner of unstructured data (for e.g. maps, huds, seperate combat window, etc).
