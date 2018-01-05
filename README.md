# WebSockClient (WSClient)

WSClient is a JavaScript library for making websocket connections from a browser to a websocket-enabled PennMUSH server. It also provides terminal emulation to convert ANSI color escape codes to colored text in an HTML DOM element.

wsclient.js provides the WSClient object which has 2 exports: WSClient.open() and WSClient.emulate().

index.html, style.css and local.js are a simple implementation of a client that provides an example of text, pueblo, and html handlers. These handlers are passed data (text string, html string, pueblo tags/attrs) and are responsible for appending that data to the terminal element in the browser. Terminal emulation must be enabled on the terminal output element before it can properly emulate ANSI color codes.

# Terminal Emulation
terminal = WSClient.emulate(root) returns a terminal emulator using DOM element "root" as the output container (usually a div).

terminal.appendText(text) appends "text" to the terminal, parsing any color escape codes into HTML/CSS.
terminal.appendHTML(html) appends "html" as a code fragment to the end of the terminal.

# Websocket Connection
connection = WSClient.open(url) returns a connection object. The "url" is of the form ws://host:port/wsclient or wss://host:port/wsclient. 

connection.sendText(text) sends the command "text" to the MUSH.

# Connection Events
Overload events on the connection object in order to handle the different types of incoming data and send it to the terminal.

connection.onOpen(evt) can be overloaded to automatically send the connect command with username/password (e.g. from an input box).

connection.onText(text) handles incoming plain text. Use terminal.appendText(text) to parse escape codes and append it to the terminal element's output.

connection.onHTML(html) handles incoming HTML code. Use terminal.appendHTML(html) to append the html code to the end of the terminal element's output.

connection.onObject(object) handles an incoming JSON object. There is no default implementation, but one could use this to pass any manner of unstructured data (for e.g. maps, huds, seperate combat window, etc).
