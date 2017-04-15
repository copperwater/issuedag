"use strict";
// file globals
var graph; // the graph singleton, instance of GraphCreator
var consts =  {
  selectedClass: "selected",
  connectClass: "connect-node",
  circleGClass: "conceptG",
  graphClass: "graph",
  activeEditId: "active-editing",
  BACKSPACE_KEY: 8,
  DELETE_KEY: 46,
  ENTER_KEY: 13,
  M_KEY: 77,
  nodeRadius: 50,
  nodeWidth: 200,
  nodeHeight:100,
  xSnapInterval: 280, // number of pixels each x will "snap" to
  yMinSpacing: 30,
};

var GraphCreator = function(svg, nodes, edges){
  var thisGraph = this;
  thisGraph.idct = 0;

  thisGraph.nodes = nodes || [];
  thisGraph.edges = edges || [];

  thisGraph.state = {
    selectedNode: null,
    selectedEdge: null,
    mouseDownNode: null,
    mouseDownLink: null,
    justDragged: false,
    justScaleTransGraph: false,
    lastKeyDown: -1,
    mode: "edgeAdd"
  };

  // define arrow markers for graph links
  var defs = svg.append('svg:defs');
  defs.append('svg:marker')
    .attr('id', 'end-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 7)
    .attr('markerWidth', 3.5)
    .attr('markerHeight', 3.5)
    .attr('orient', 'auto')
    .append('svg:path')
    .attr('d', 'M0,-5L10,0L0,5');

  // define arrow markers for leading arrow
  defs.append('svg:marker')
    .attr('id', 'mark-end-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 7)
    .attr('markerWidth', 3.5)
    .attr('markerHeight', 3.5)
    .attr('orient', 'auto')
    .append('svg:path')
    .attr('d', 'M0,-5L10,0L0,5');

  thisGraph.svg = svg;
  thisGraph.svgG = svg.append("g")
        .classed(consts.graphClass, true);
  var svgG = thisGraph.svgG;

  // displayed when dragging between nodes
  thisGraph.dragLine = svgG.append('svg:path')
        .attr('class', 'link dragline hidden')
        .attr('d', 'M0,0L0,0')
        .style('marker-end', 'url(#mark-end-arrow)');

  // svg nodes and edges
  thisGraph.paths = svgG.append("g").selectAll("g");
  thisGraph.circles = svgG.append("g").selectAll("g");

  thisGraph.drag = d3.behavior.drag()
        .origin(function(d){
          return {x: d.x, y: d.y};
        })
        .on("drag", function(args){
          thisGraph.state.justDragged = true;
          thisGraph.dragmove.call(thisGraph, args);
        })
        .on("dragend", function() {
          // todo check if edge-mode is selected
        });

  // listen for key events
  d3.select(window).on("keydown", function(){
    thisGraph.svgKeyDown.call(thisGraph);
  })
  .on("keyup", function(){
    thisGraph.svgKeyUp.call(thisGraph);
  });
  svg.on("mousedown", function(d){thisGraph.svgMouseDown.call(thisGraph, d);});
  svg.on("mouseup", function(d){thisGraph.svgMouseUp.call(thisGraph, d);});

  // listen for dragging
  var dragSvg = d3.behavior.zoom()
        .on("zoom", function(){
          if (d3.event.sourceEvent.shiftKey){
            // TODO  the internal d3 state is still changing
            return false;
          } else{
            thisGraph.zoomed.call(thisGraph);
          }
          return true;
        })
        .on("zoomstart", function(){
          var ael = d3.select("#" + consts.activeEditId).node();
          if (ael){
            ael.blur();
          }
          if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
        })
        .on("zoomend", function(){
          d3.select('body').style("cursor", "auto");
        });

  svg.call(dragSvg).on("dblclick.zoom", null);

  // listen for resize
  window.onresize = function(){thisGraph.updateWindow(svg);};

};

GraphCreator.prototype.setIdCt = function(idct){
  this.idct = idct;
};

/* PROTOTYPE FUNCTIONS */

GraphCreator.prototype.dragmove = function(d) {
  var thisGraph = this;
  if (thisGraph.state.mode === "edgeAdd"){
    thisGraph.dragLine.attr('d', 'M' + (d.x+consts.nodeWidth) + ',' + (d.y+consts.nodeHeight/2) + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
  } else if (thisGraph.state.mode === "nodeMove") {
    d.x += d3.event.dx;
    d.y +=  d3.event.dy;
    thisGraph.updateGraph();
  }
};

/* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
GraphCreator.prototype.insertText = function (gEl, node) {
  var htmlString = '<h4 style="margin:0.5em 0;">';
  if (node.url) {
    htmlString += '<a href="' + node.url + '">' + node.title + '</a>';
  }
  else {
    htmlString += node.title;
  }
  htmlString += '</h4>' +
    '<p style="margin: 0 1em">'+node.description+'</p>';
  var titleEl = gEl.append("foreignObject")
    .attr('width', consts.nodeWidth)
    .attr('height', consts.nodeHeight)
    // .attr('dy', 0)
    .append('xhtml:body')
    .style('font', '14px "Courier New"')
    .style('background-color', '#eee')
    .style('text-align', 'center')
    .style('height', '100%')
    .style('overflow-y', 'hidden')
    .html(htmlString);

};


// remove edges associated with a node
GraphCreator.prototype.spliceLinksForNode = function(node) {
  var thisGraph = this,
      toSplice = thisGraph.edges.filter(function(l) {
    return (l.source === node || l.target === node);
  });
  toSplice.map(function(l) {
    thisGraph.edges.splice(thisGraph.edges.indexOf(l), 1);
  });
};

GraphCreator.prototype.replaceSelectEdge = function(d3Path, edgeData){
  var thisGraph = this;
  d3Path.classed(consts.selectedClass, true);
  if (thisGraph.state.selectedEdge){
    thisGraph.removeSelectFromEdge();
  }
  thisGraph.state.selectedEdge = edgeData;
};

GraphCreator.prototype.replaceSelectNode = function(d3Node, nodeData){
  var thisGraph = this;
  d3Node.classed(consts.selectedClass, true);
  if (thisGraph.state.selectedNode){
    thisGraph.removeSelectFromNode();
  }
  thisGraph.state.selectedNode = nodeData;
};

GraphCreator.prototype.removeSelectFromNode = function(){
  var thisGraph = this;
  thisGraph.circles.filter(function(cd){
    return cd.id === thisGraph.state.selectedNode.id;
  }).classed(consts.selectedClass, false);
  thisGraph.state.selectedNode = null;
};

GraphCreator.prototype.removeSelectFromEdge = function(){
  var thisGraph = this;
  thisGraph.paths.filter(function(cd){
    return cd === thisGraph.state.selectedEdge;
  }).classed(consts.selectedClass, false);
  thisGraph.state.selectedEdge = null;
};

GraphCreator.prototype.pathMouseDown = function(d3path, d){
  var thisGraph = this,
      state = thisGraph.state;
  d3.event.stopPropagation();
  state.mouseDownLink = d;

  if (state.selectedNode){
    thisGraph.removeSelectFromNode();
  }

  var prevEdge = state.selectedEdge;
  if (!prevEdge || prevEdge !== d){
    thisGraph.replaceSelectEdge(d3path, d);
  } else{
    thisGraph.removeSelectFromEdge();
  }
};

// mousedown on node
GraphCreator.prototype.circleMouseDown = function(d3node, d){
  var thisGraph = this;
  var state = thisGraph.state;
  d3.event.stopPropagation();
  state.mouseDownNode = d;
  if (state.mode === "edgeAdd"){
    // reposition dragged directed edge
    // this causes the triangle to appear annoyingly at the corner
    // of the node. Put it behind the node where nobody will notice.
    var newX = d.x + (consts.nodeWidth / 2);
    var newY = d.y + (consts.nodeHeight / 2);

    thisGraph.dragLine.classed('hidden', false)
      .attr('d', 'M' + newX + ',' + newY + 'L' + newX + ',' + newY);
    return;
  }
};


// mouseup on nodes
GraphCreator.prototype.circleMouseUp = function(d3node, d){
  var thisGraph = this,
      state = thisGraph.state;
  // reset the states
  d3node.classed(consts.connectClass, false);

  var mouseDownNode = state.mouseDownNode;

  if (!mouseDownNode) return;

  thisGraph.dragLine.classed("hidden", true);

  if (state.justDragged) {
    if(state.mode === "edgeAdd" && mouseDownNode !== d) {
      // draw a new edge between the nodes
      thisGraph.addEdge(mouseDownNode, d);
    }
    else {
      // dragged, not clicked
      state.justDragged = false;
      // snap to nearest grid space, defined by xMinSpacing and node width
      mouseDownNode.x = Math.round(mouseDownNode.x / consts.xSnapInterval) * consts.xSnapInterval;
      thisGraph.spaceNodes(mouseDownNode);
    }
    thisGraph.updateGraph();
  } else {
    // clicked, not dragged
      if (state.selectedEdge){
        thisGraph.removeSelectFromEdge();
      }
      var prevNode = state.selectedNode;

      if (!prevNode || prevNode.id !== d.id){
        thisGraph.replaceSelectNode(d3node, d);
      } else{
        thisGraph.removeSelectFromNode();
      }
  }
  state.mouseDownNode = null;
  return;

}; // end of circles mouseup

GraphCreator.prototype.addEdge = function(sourceNode, destNode) {
  var thisGraph = this;

  // first make sure the new edge being introduced doesn't complete a cycle
  // do a DFS from destNode and if sourceNode is reachable, this edge cannot be added
  // TODO: exception: reversing the direction of a node shouldn't take into account the existing edge
  // (it should still check for cycles though)
  var idSeen = [];
  var nodeStack = [ destNode ];
  var hasCycle = false;
  while(nodeStack.length > 0) {
    var currNode = nodeStack.pop();
    if(currNode.id === sourceNode.id) {
      hasCycle = true;
      break;
    }
    // console.log(currNode.id);
    if(idSeen.indexOf(currNode.id) === -1) {
      idSeen.push(currNode.id);
      var newEdges = thisGraph.edges.map(function(edge) {
        if(edge.source.id === currNode.id) {
          nodeStack.push(edge.target);
        }
      });
    }
  }
  if(hasCycle) {
    return;
  }

  var newEdge = {source: sourceNode, target: destNode };

  var filtRes = thisGraph.paths.filter(function(d){
    // edges can only be directed one way - have to remove opposite edge if it exists
    if (d.source === newEdge.target && d.target === newEdge.source){
      thisGraph.edges.splice(thisGraph.edges.indexOf(d), 1);
    }
    return d.source === newEdge.source && d.target === newEdge.target;
  });

  if (!filtRes[0].length) {
    thisGraph.edges.push(newEdge);
  }

  // edges shouldn't be going from right to left
  thisGraph.shoveNodesRight(sourceNode);
};

/* Given a node, force all nodes with edges coming in from this node to be laid out
 * so that the sourceNode is further left than the destination nodes.
 * If destNode is undefined, shove all nodes that have an edge coming from sourceNode.
 * Propagate these changes out recursively through the entire tree of nodes.
 * Assumes no cycles in the graph.
 */
GraphCreator.prototype.shoveNodesRight = function(sourceNode) {
  var thisGraph = this;
  thisGraph.edges.map(function(edge) {
    if(edge.source.id === sourceNode.id) {
      thisGraph.shoveRight(sourceNode.x, edge.target);
      thisGraph.shoveNodesRight(edge.target);
      thisGraph.spaceNodes(edge.target);
    }
  });
};

/* Given an x value and a node, ensure that the node is at least 1 "node space" to the right
 * along the x-axis. Maintain the same y-value and re-space other nodes along the y-axis as needed.
 */
GraphCreator.prototype.shoveRight = function(x, node) {
  var thisGraph = this;
  if(x + consts.xSnapInterval <= node.x) {
    return;
  }
  node.x = (Math.floor(x / consts.xSnapInterval) + 1) * consts.xSnapInterval;
};

// mousedown on main svg
GraphCreator.prototype.svgMouseDown = function(){
  this.state.graphMouseDown = true;
};

// mouseup on main svg
GraphCreator.prototype.svgMouseUp = function(){
  var thisGraph = this,
      state = thisGraph.state;
  if (state.justScaleTransGraph) {
    // dragged not clicked
    state.justScaleTransGraph = false;
  } else if (state.mode === "edgeAdd"){
    thisGraph.dragLine.classed("hidden", true);
  }
  state.graphMouseDown = false;
};

GraphCreator.prototype.addNode = function(title, desc, x, y) {
  var thisGraph = this;
  if(typeof x === 'undefined') {
    var box = document.getElementById('main-svg').getBBox();
    var rect = document.getElementById('main-svg').getBoundingClientRect();
    x = (box.x * -1) + (rect.width / 2) - (consts.nodeWidth / 2);
    y = (box.y * -1) + (rect.height / 2) - (consts.nodeHeight / 2);
    // set to middle of view window
  }
  var nodeData = {
    id: thisGraph.idct,
    title: title,
    description: desc,
    x: Math.round(x / consts.xSnapInterval) * consts.xSnapInterval,
    y: y
  };
  thisGraph.idct++;
  thisGraph.nodes.push(nodeData);
  thisGraph.spaceNodes(nodeData);
  thisGraph.updateGraph();
};

// keydown on main svg
GraphCreator.prototype.svgKeyDown = function() {
  var thisGraph = this,
      state = thisGraph.state;
  // make sure repeated key presses don't register for each keydown
  if(state.lastKeyDown !== -1) return;

  state.lastKeyDown = d3.event.keyCode;
  var selectedNode = state.selectedNode,
      selectedEdge = state.selectedEdge;

  switch(d3.event.keyCode) {
    case consts.BACKSPACE_KEY:
    case consts.DELETE_KEY:
      d3.event.preventDefault();
      if (selectedNode){
        thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
        thisGraph.spliceLinksForNode(selectedNode);
        state.selectedNode = null;
        thisGraph.updateGraph();
      } else if (selectedEdge){
        thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
        state.selectedEdge = null;
        thisGraph.updateGraph();
      }
      break;
    case consts.M_KEY:
      if(thisGraph.state.mode === "edgeAdd") {
        thisGraph.state.mode = "nodeMove";
        document.getElementById('nodemode').classList.remove('hidden');
        document.getElementById('edgemode').classList.add('hidden');
      }
      else if (thisGraph.state.mode === "nodeMove") {
        thisGraph.state.mode = "edgeAdd";
        document.getElementById('nodemode').classList.add('hidden');
        document.getElementById('edgemode').classList.remove('hidden');
      }
      break;
  }
};

GraphCreator.prototype.svgKeyUp = function() {
  this.state.lastKeyDown = -1;
};

/* Given a node, make sure it's vertically far enough away from other nodes. */
GraphCreator.prototype.spaceNodes = function(node) {
  // create a list of [ node_index, y ] small arrays that are on this x, then sort by y
  var lst = [];
  var cachedLength = this.nodes.length;
  for(var i=0; i<cachedLength; ++i) {
    if((this.nodes[i].id !== node.id) && (this.nodes[i].x === node.x)) {
      lst.push( [ i, this.nodes[i].y ] );
    }
  }
  lst.sort(function(a,b) {
    return a[1] - b[1];
  })

  // find the index in lst where y "fits" with a binary search
  cachedLength = lst.length;
  var low = -1;
  var high = cachedLength;
  var x = Math.floor((low + high) / 2);
  while(low < x) {
    if(lst[x][1] <= node.y) {
      low = x;
    }
    else if(lst[x][1] > node.y) {
      high = x;
    }
    x = Math.floor((low + high) / 2);
  }

  // now low should be the index of the highest element in the list with a y <= node.y,
  // and high should be low+1
  // iterate from low to 0, moving nodes to a smaller y-value,
  // then iterate from high forward, moving nodes to a larger y-value
  var currentY = node.y;
  for(var i=low; i>=0; --i) {
    // node doesn't need to be moved if its y is low enough to be below currentY with
    // ample spacing between the nodes.
    var targetY = currentY - (consts.nodeHeight + consts.yMinSpacing);
    if(this.nodes[lst[i][0]].y > targetY) {
      this.nodes[lst[i][0]].y = targetY;
      currentY = targetY;
    }
    else {
      break; // no further movement is needed
    }
  }
  currentY = node.y;
  for(var i=high; i<cachedLength; ++i) {
    var targetY = currentY + (consts.nodeHeight + consts.yMinSpacing);
    if(this.nodes[lst[i][0]].y < targetY) {
      this.nodes[lst[i][0]].y = targetY;
      currentY = targetY;
    }
    else {
      break;
    }
  }
}

// call to propagate changes to graph
GraphCreator.prototype.updateGraph = function(){

  var thisGraph = this,
      state = thisGraph.state;

  thisGraph.paths = thisGraph.paths.data(thisGraph.edges, function(d){
    return String(d.source.id) + "+" + String(d.target.id);
  });
  var paths = thisGraph.paths;
  // xyzzy
  var box2box = function(node) {
    /* Return SVG path specification between midpoint of right edge of source and midpoint of left edge of destination. */
    /*
    // This code is for potentially drawing the edge to a corner later.
    var targetY = node.target.y;
    console.log(thisGraph.state);
    if(node.source.y > node.target.y) {
      targetY += thisGraph.consts.nodeHeight;
    }
    */
    var targetY = node.target.y + consts.nodeHeight/2;
    return "M" + (node.source.x + consts.nodeWidth) + ","
      + (node.source.y + consts.nodeHeight/2)
      + "L" + node.target.x + ","
      + targetY;
  }
  // update existing paths
  paths.style('marker-end', 'url(#end-arrow)')
    .classed(consts.selectedClass, function(d){
      return d === state.selectedEdge;
    })
    .attr("d", box2box);

  // add new paths
  paths.enter()
    .append("path")
    .style('marker-end','url(#end-arrow)')
    .classed("link", true)
    .attr("d", box2box)
    .on("mousedown", function(d){
      thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
      }
    )
    .on("mouseup", function(d){
      state.mouseDownLink = null;
    });

  // remove old links
  paths.exit().remove();

  // update existing nodes
  thisGraph.circles = thisGraph.circles.data(thisGraph.nodes, function(d){ return d.id;});
  thisGraph.circles.attr("transform", function(d){return "translate(" + d.x + "," + d.y + ")";});

  // add new nodes
  var newGs= thisGraph.circles.enter()
        .append("g");

  newGs.classed(consts.circleGClass, true)
    .attr("transform", function(d){return "translate(" + d.x + "," + d.y + ")";})
    .on("mouseover", function(d){
      d3.select(this).classed(consts.connectClass, true);
    })
    .on("mouseout", function(d){
      d3.select(this).classed(consts.connectClass, false);
    })
    .on("mousedown", function(d){
      thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
    })
    .on("mouseup", function(d){
      thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
    })
    .call(thisGraph.drag);

  newGs.append("rect")
    // .attr("r", String(consts.nodeRadius));
    .attr("width", "200")
    .attr("height", "100")
    .attr("fill", "white")
    .attr("stroke", "black")
    .attr('stroke-width', '4');

  newGs.each(function(d){
    thisGraph.insertText(d3.select(this), d);
  });

  // remove old nodes
  thisGraph.circles.exit().remove();
};

GraphCreator.prototype.zoomed = function(){
  this.state.justScaleTransGraph = true;
  d3.select("." + consts.graphClass)
    .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
};

GraphCreator.prototype.updateWindow = function(svg){
  var docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0];
  var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
  var y = window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;
  svg.attr("width", x).attr("height", y);
};

window.showNodeDialog = function() {
  document.getElementById('new-node-overlay').style.display = "block";
};
window.dispelNodeDialog = function() {
  document.getElementById('new-node-overlay').style.display = "none";
};
window.addNewNode = function() {
  // document.getElementById(
  graph.addNode('sdfsdf', 'sdfsdfsdf');
  window.dispelNodeDialog();
};


/**** MAIN ****/
document.onload = (function(d3){

  // warn the user when leaving
  // window.onbeforeunload = function(){
  //   return "Make sure to save your graph locally before leaving :-)";
  // };

  var docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0];

  var width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth,
      height =  window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;

  /** MAIN SVG **/
  var svg = d3.select('#graph').append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("xmlns", "https://www.w3.org/2000/svg")
        .attr('id', 'main-svg');

  var req = new XMLHttpRequest();
  req.open('GET', '/issues.json');
  req.onreadystatechange = function() {
    if(req.readyState === 4) {
      var response = JSON.parse(req.responseText);
      var counter = 0;
      response.issues.map(function(issue) {
        issue.description = issue.title;
        issue.title = "#" + issue.number;
        issue.id = counter;
        issue.x = 0;
        issue.y = counter * (consts.yMinSpacing + consts.nodeHeight);
        counter++;
      });
      // dependencies = [ {source:issues[0], target:issues[1] }];
      var dependencies = [];

      graph = new GraphCreator(svg, response.issues, dependencies);
      // assumes that if nodes are provided, the ids are sequential
      graph.setIdCt(response.issues.length);
      graph.updateGraph();
    }
  };
  req.send();
})(window.d3);

/*
 * TODO: Can't edit nodes in place, can create and delete "not an issue" nodes through a button.
 * TODO: Arrows end at either the top left or bottom left corner based on relative y. (Deferred)
 * TODO: Drag edge "snaps" to node when cursor mouseovers that node.
 * TODO: Save functionality
 */
