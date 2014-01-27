var Faye = require('faye');
var GameLoopDispatch = require('game-loop-dispatch');
var uuid = require('node-uuid');
var _ = require('lodash');

var OSRM = require('./OSRM.RoutingGeometry.js');
var request = require('superagent');

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

  this.toString = function() {
    return [this.lat, this.lng].join(",");
  }
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

  this.waypoints = null;
  this.api_url = 'http://router.project-osrm.org/viaroute';

  var from = new Position();
  var to = new Position();

  // this.route_endpoints = [from.toString(), to.toString()]
  this.route_endpoints = ["47.076851,15.414179", "47.068828,15.443282"]

  request.get(this.api_url)
    .query({  z: 14,
              output: "json", instructions: true,
              jsonp: "OSRM.JSONP.callbacks.redraw" })
    .query("loc=" + this.route_endpoints[0] + "&loc=" + this.route_endpoints[1])
    .set("Accept", "application/json")
    .set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36")
    .end(function(res) {
      console.log(res.text);
      data = JSON.parse(res.text.match(/.*?\((.*?)\)/)[1]);

      var waypoints = OSRM.RoutingGeometry._decode(data["route_geometry"], OSRM.CONSTANTS.PRECISION);
      this.waypoints = waypoints.concat(OSRM.RoutingGeometry._decode(data["alternative_geometries"][0], OSRM.CONSTANTS.PRECISION).reverse())
      console.log(this.waypoints);
    }.bind(this));
  
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

    if(!this.waypoints) return;
    var nextWaypoint = this.waypoints[this.counter];

    console.log(this.nickname + " " + nextWaypoint);
    this.hub.publish(this.track.channel.path,
                   { coords:
                     { latitude: nextWaypoint[0],
                       longitude: nextWaypoint[1],
                       accuracy: 20 },
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
//_.times(3, function(){ ghosts.push(new Ghost(pubsub)); });

ghosts.push(new Ghost(pubsub));

loop.tick = function(){
    console.log("tick");
  _.each(ghosts, function(ghost){ ghost.publish(); });
};

loop.start();
