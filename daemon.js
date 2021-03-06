var Faye = require('faye');
var GameLoopDispatch = require('game-loop-dispatch');
var uuid = require('node-uuid');
var _ = require('lodash');

var OSRM = require('./OSRM.RoutingGeometry.js');
var request = require('superagent');
var xml = require('node-xml');

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

var Position = function(position){
  max = 50; mul = 0.0025;
  this.lat = position[0] - (max/2)*mul + Math.floor(Math.random()*max)*mul;
  this.lng = position[1] - (max/2)*mul + Math.floor(Math.random()*max)*mul;

  this.toString = function() {
    return [this.lat, this.lng].join(",");
  }
};

var Ghost = function(hub, position){
  this.hub = hub;
  this.position = position;
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

  this.waypoints = null;
  this.api_url = 'http://router.project-osrm.org/viaroute';

  var from = new Position(position);
  var mid = new Position(position);
  var to = new Position(position);

  this.route_endpoints = [from.toString(), mid.toString(), to.toString(), from.toString()];

  request.get(this.api_url)
    .query({ z: 14,
             output: "json", instructions: true,
             jsonp: "OSRM.JSONP.callbacks.redraw" })
    .query("loc=" + this.route_endpoints.join("&loc="))
    .set("Accept", "application/json")
    .set("User-Agent", "dspace-daemon-ai-player/0.0.1")
    .end(function(res) {
      var data = JSON.parse(res.text.match(/.*?\((.*?)\)/)[1]);
      this.waypoints = OSRM.RoutingGeometry._decode(data["route_geometry"], OSRM.CONSTANTS.PRECISION);
      this.speed = Math.random()*0.001;
      this.waypoints = _.flatten(_.map(this.waypoints, function(waypoint, index){
        if(waypoint === this.waypoints[this.waypoints.length - 1]){
          return [];
        }
        var interpolations = [];
        var next = this.waypoints[index + 1];
        var distance = {
          x: next[0] - waypoint[0],
          y: next[1] - waypoint[1]
        };
        var steps = Math.sqrt(Math.pow(distance.x, 2) + Math.pow(distance.y, 2)) / this.speed;
        var offset = {
          x: 0,
          y: 0
        };
        for(i=0; i < steps; i++){
          interpolations.push([waypoint[0] + offset.x, waypoint[1] + offset.y]);
          offset.x += distance.x / steps;
          offset.y += distance.y / steps;
        }
        return interpolations;
      }.bind(this)), true); // shallow

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

var loop = new GameLoopDispatch({ interval: 500 });


var getStartPosition = function(city_name, startCb) {
  if(!city_name)  city_name = "Graz"

  //var overpass_url = 'http://overpass-api.de/api/interpreter';
  var overpass_url = 'http://overpass.osm.rambler.ru/cgi/interpreter';

  var query = '<?xml version="1.0" encoding="UTF-8"?><osm-script><query type="node"><has-kv k="name" v="' + city_name + '"/><has-kv k="place" v="city"/></query><print/></osm-script>';
  var parser = new xml.SaxParser(function(p) {
    p.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
      if(elem == 'node') {
        attrs = attrs.reduce(function(a, kv) { a[kv[0]] = kv[1]; return a; }, {});
        startCb([Number(attrs.lat), Number(attrs.lon)]);
      }
    }.bind(this));
  });
  request
    .get(overpass_url)
    .query({"data": query})
    .end(function(res) {
      var buf = new Buffer([]);
      res.on('data', function(chunk) { buf = Buffer.concat([buf, chunk]); });
      res.on('end', function() {
        parser.parseString(buf.toString());
      });
    });
}

getStartPosition(process.argv[2], function(start_position) {
  var ghosts = [];  
  _.times(5, function(){ ghosts.push(new Ghost(pubsub, start_position)); }.bind(this));
  loop.tick = function(){ _.each(ghosts, function(ghost){ ghost.publish(); }); };
  loop.start();
});
