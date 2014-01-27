var Faye = require('faye');
var GameLoopDispatch = require('game-loop-dispatch');
var uuid = require('node-uuid');
var _ = require('lodash');

var OSRM = require('OSRM.RoutingGeometry.js')

var hubUrl = 'http://localhost:5000';
var bayeuxUrl = hubUrl + '/bayeux';

var avatars = [
  'elvis',
  'emo',
  'escafandra',
  'estilista',
  'extraterrestre',
  'fisicoculturista',
  'funky',
  'futbolista_brasilero',
  'gay',
  'geisha',
  'ghostbuster',
  'glamrock_singer',
  'guerrero_chino',
  'hiphopper',
  'hombre_hippie'
];

var randomAvatar = function(){
  return avatars[Math.floor(Math.random()*avatars.length)];
};

var teams = ['ESC', 'LL+GW', 'ORWELL', 'FH-J', 'CY', undefined];

var randomTeam = function(){
  return teams[Math.floor(Math.random()*teams.length)];
};

var Position = function(){
  this.lat = 47.05 + Math.floor(Math.random()*30)*0.001;
  this.lng = 15.42 + Math.floor(Math.random()*30)*0.001;
};

var Ghost = function(hub){
  this.hub = hub;
  this.uuid = uuid();
  this.avatar = randomAvatar() ;
  this.nickname = this.avatar;
  this.team = randomTeam();
  this.color = '#' + Math.floor(Math.random()*16777215).toString(16);
  this.track = {
    channel: {
      url: bayeuxUrl,
      path: '/' + this.uuid + '/track',
      protocol: 'bayeux'
    },
    feed: {
      url: hubUrl,
      path: '/' + this.uuid + '/track',
    }
  };
  this.position = new Position();

  this.route = "e~ixxAeyxk\\~WbZdOnt@ttIqyBob@cwG}Es}BtXohQzoA}i@bG}pEt@_r@dBqi@h|DgbC~|BsrAoHcu@dLitBw_AepA{t@ydCu\\{Vqu@cIo]|u@i[`qC}EtM}GuQ";
  this.waypoints = OSRM.RoutingGeometry._decode(this.route, OSRM.CONSTANTS.PRECISION)
  this.counter = 0;

  this.toJSON = function(){
    return {
      uuid: this.uuid,
      nickname: this.nickname,
      avatar: this.avatar,
      team: this.team,
      color: this.color,
      track: this.track,
    };
  }.bind(this);

  this.publish = function(){
    var nextWaypoint = this.waypoints[this.counter];

    console.log(this.nickname + " " + nextWaypoint);
    this.hub.publish(this.track.channel.path,
                   { coords:
                     { latitude: nextWaypoint[0],
                       longitude: nextWaypoint[1],
                       accuracy: 20 },
                       timestamp: new Date().getTime(),
                       player: { uuid: this.uuid } }
                  );

    //this.avatar = randomAvatar();
    this.hub.publish('/dev', this.toJSON() );

    this.counter++;
    if(this.counter >= this.waypoints.length)  this.counter = 0;

  }.bind(this);
};

var pubsub = new Faye.Client(bayeuxUrl);

var loop = new GameLoopDispatch({ interval: 2000 });

var ghosts = [];
_.times(3, function(){ ghosts.push(new Ghost(pubsub)); });

loop.tick = function(){
  _.each(ghosts, function(ghost){ ghost.publish(); });
};

loop.start();
