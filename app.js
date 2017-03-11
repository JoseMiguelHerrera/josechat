var express = require('express');
var cookieParser = require('cookie-parser')
var cfenv = require('cfenv');
var favicon = require('serve-favicon');



// create a new express server
var app = express();
// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));
// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();
// start server on the specified port and binding host
var server = app.listen(appEnv.port, '0.0.0.0', function () {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
var io = require('socket.io').listen(server);
app.use(cookieParser());

app.use(favicon(__dirname + '/public/images/favicon.ico'));




//user state
function users() {
  this.userlist = [];
  this.numberOfUsersOnline = 0;
  this.MaxnumberOfUsersOnline = 0;

  this.addnewUser = function () {
    this.numberOfUsersOnline++;

    if (this.numberOfUsersOnline > this.MaxnumberOfUsersOnline) {
      this.MaxnumberOfUsersOnline = this.numberOfUsersOnline;
    }

    //var guestname = "Guest User #" + (this.MaxnumberOfUsersOnline);
    var guestname = ""


    for (i = 1; i <= this.MaxnumberOfUsersOnline; i++) {
      var guestnamePossible = "Guest User #" + i;
      var index = this.userlist.indexOf(guestnamePossible);
      if (index === -1) { //username is free
        guestname = guestnamePossible;
        break;
      }
    }
    this.userlist.push(guestname)
    return guestname;
  };
  this.removeUser = function (userToDelete) {
    var index = this.userlist.indexOf(userToDelete);
    if (index >= 0) {
      this.userlist.splice(index, 1);
    }
    this.numberOfUsersOnline--;
  }
  this.changeNickName = function (oldName, newname) {
    var index_curr = this.userlist.indexOf(oldName);
    var index_newName = this.userlist.indexOf(newname);
    if (index_curr !== -1 && index_newName === -1) { //the given old name exists and the new desired name doesn't
      this.userlist[index_curr] = newname;
      return true;
    } else {
      return false;
    }
  }
}

//message state
function messages(numMsgSaved) {

  this.messagelist = [];
  this.maxMsgSaved = numMsgSaved;

  this.newMessage = function (username, textMsg) {
    var message = {
      user: username,
      text: textMsg,
      timestamp: Date.now()
    }

    var currMsgNum = this.messagelist.unshift(message);
    if (currMsgNum > this.maxMsgSaved) {
      this.messagelist.pop();
    }

    return (message);
  }

}

var theUsers = new users();
var theMessages = new messages(200);

//socketIO logic
io.sockets.on('connection', function (socket) {
  var currUser = theUsers.addnewUser()
  console.log("a client " + currUser + " has connected via sockets");

  // initialize the new client
  socket.emit('init', {
    name: currUser,
    users: theUsers.userlist,
    messages: theMessages.messagelist
  });

  // notify other clients that a new user has joined
  socket.broadcast.emit('user:join', {
    name: currUser
  });

  // broadcast a user's message to other users
  socket.on('send:message', function (data, callback) {
    var msg = theMessages.newMessage(currUser, data.text);
    console.log(msg);
    socket.broadcast.emit('send:message', msg);
    callback(msg);
  });

  socket.on('disconnect', function () {
    socket.broadcast.emit('user:left', {
      name: currUser
    });
    theUsers.removeUser(currUser);
    console.log("client " + currUser + " has left");
  });

  // validate a user's name change, and broadcast it on success
  socket.on('change:name', function (data, callback) {

    /* cookies here
      // check if client sent cookie
      var cookie = req.cookies.cookieName;
      if (cookie === undefined)
      {
            res.cookie('NickNameCookie',data.name, { maxAge: 900000, httpOnly: true });
    
      }else{
        // yes, cookie was already present 
        console.log('cookie exists', cookie);
        
      }
      */
    console.log(data.name);
    var result = theUsers.changeNickName(currUser, data.name);

    if (result) {
      console.log("nickname for " + currUser + " has been changed to " + data.name)
      socket.broadcast.emit('change:name', {
        oldName: currUser,
        newName: data.name
      });
      currUser = data.name;
      callback(true);
    } else {
      console.log("name change failed");
      socket.broadcast.emit('change:name', {
        oldName: currUser,
        newName: currUser
      });
      callback(false);
    }
  });



});








