var CanvasView = function() {
	MicroEvent.mixin(CanvasView);

	this.setHeight = function(height) {
		this.getContainer().height(height);
	};

	this.enableScroll = function() {
		this.getContainer().scrollview();
	};

	this.getDrawingArea = function() {
		return $("#drawing-area");
	};

	this.getContainer = function() {
		return $("#canvas-container");
	};
};

CanvasView.prototype.drawMap = function(map) {
	throw new Error("Not implemented");
};

var DefaultCanvasView = function() {
	var self = this;

	var drawConnection = function(canvas, depth, offsetX, offsetY) {
		// console.log("drawing");
		var ctx = canvas.getContext("2d");

		var lineWidth = 10 - depth || 1;
		ctx.lineWidth = lineWidth;

		var startX = offsetX > 0 ? 0 : -offsetX;
		var startY = offsetY > 0 ? 0 : -offsetY;

		var endX = startX + offsetX;
		var endY = startY + offsetY;

		ctx.beginPath();
		ctx.moveTo(startX, startY);

		var cp1x = startX + (offsetX / 5);
		var cp1y = startY;
		var cp2x = startX + (offsetX / 2);
		var cp2y = endY;

		ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
		// ctx.lineTo(startX + offsetX, startY + offsetY);
		ctx.stroke();

		var drawControlPoints = false;

		if (drawControlPoints) {
			// control points
			ctx.beginPath();
			ctx.fillStyle = "red";
			ctx.arc(cp1x, cp1y, 4, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.fillStyle = "green";
			ctx.arc(cp2x, cp2y, 4, 0, Math.PI * 2);
			ctx.fill();
		}
	};

	var positionLineCanvas = function($canvas, offsetX, offsetY) {
		var width = Math.abs(offsetX);
		var height = Math.abs(offsetY);

		var left = offsetX < 0 ? 0 : -width;
		var top = offsetY < 0 ? 0 : -height;

		$canvas.attr({
			width : width,
			height : height
		}).css({
			left : left + "px",
			top : top + "px"
		});
	};

	var createNode = function(node, $parent, depth) {
		var offsetX = node.offset.x;
		var offsetY = node.offset.y;

		// div node container
		var $node = $("<div/>", {
			id : "node-" + node.id,
			class : "node-container"
		}).css({
			left : offsetX + "px",
			top : offsetY + "px"
		}).data({
			depth : depth
		}).appendTo($parent);

		if (node.isRoot()) {
			$node.addClass("mindmap root");
		}

		// node drag behaviour
		$node.draggable({
			handle : "div.node-caption:first",
			start : function() {
				// console.log("drag start");
				// cant drag root
				if (node.isRoot()) {
					return false;
				}

				// select on drag
				if (self.nodeSelected) {
					self.nodeSelected(node);
				}
			},
			drag : function(e, ui) {
				// reposition and draw canvas while dragging
				var $canvas = $("#canvas-node-" + node.id);
				var offsetX = ui.position.left;
				var offsetY = ui.position.top;
				var depth = $node.data("depth");

				positionLineCanvas($canvas, offsetX, offsetY);
				drawConnection($canvas[0], depth, offsetX, offsetY);

				// fire dragging event
				if (self.nodeDragging) {
					self.nodeDragging();
				}
			},
			stop : function(e, ui) {
				var pos = new Point(ui.position.left, ui.position.top);

				// fire dragged event
				if (self.nodeDragged) {
					self.nodeDragged(node, pos);
				}
			}
		});

		// text caption
		var $text = $("<div/>", {
			class : "node-caption no-select",
			text : node.text.caption
		}).click(function() {
			// TODO prevent firing event after drag
			if (self.nodeSelected) {
				self.nodeSelected(node);
			}
		}).appendTo($node);

		// collapse button
		if (!node.isLeaf()) {
			var $collapseButton = $("<div/>", {
				class : "button-collapse no-select"
			}).click(function(e) {
				// fire event
				if (self.collapseButtonClicked) {
					self.collapseButtonClicked(node);
				}

				e.preventDefault();
				return false;
			}).appendTo($node);
		}

		// draw canvas to parent if node is not a root
		if (!node.isRoot()) {
			// create canvas element
			var $canvas = $("<canvas>", {
				id : "canvas-node-" + node.id,
				class : "line-canvas"
			});

			// position and draw connection
			positionLineCanvas($canvas, offsetX, offsetY);
			drawConnection($canvas[0], depth, offsetX, offsetY);

			$canvas.appendTo($node);
		}

		// draw child nodes
		node.forEachChild(function(child) {
			createNode(child, $node, depth + 1);
		});
	};

	this.drawMap = function(map) {
		// clear map first
		var container = this.getDrawingArea();
		container.children(".root").remove();

		var root = map.root;

		// center root
		var center = new Point(container.width() / 2, container.height() / 2);
		root.offset = center;

		createNode(root, container, 0);

		// run a 2nd pass and toggle visibility
		// can only do that after the tree is completely constructed
		root.forEachDescendant(function(node) {
			if (node.collapseChildren) {
				self.closeNode(node);
			} else {
				self.openNode(node);
			}
		});

		// TODO deselect on click in void?
		$("#scroller").click(function() {
			console.log("click drawing area");
		});

	};

	this.selectNode = function(node) {
		var $node = $("#node-" + node.id);
		var $text = $node.children(".node-caption").first();

		$text.addClass("selected");
	};

	this.deselectNode = function(node) {
		var $node = $("#node-" + node.id);
		var $text = $node.children(".node-caption").first();

		$text.removeClass("selected");
	};

	this.closeNode = function(node) {
		// console.log("closing node ", node.id);
		var $node = $("#node-" + node.id);
		$node.children(".node-container").hide();

		var $collapseButton = $node.children(".button-collapse").first();
		$collapseButton.removeClass("open").addClass("closed");
	};

	this.openNode = function(node) {
		// console.log("opening node ", node.id);
		var $node = $("#node-" + node.id);
		$node.children(".node-container").show();

		var $collapseButton = $node.children(".button-collapse").first();
		$collapseButton.removeClass("closed").addClass("open");
	};

	this.deleteNode = function(node) {
		var $node = $("#node-" + node.id);
		$node.remove();
	};

	this.removeCollapseButton = function(node) {
		var $node = $("#node-" + node.id);
		$node.children(".button-collapse").remove();
	};
};

// inherit from base canvas view
DefaultCanvasView.prototype = new CanvasView();

var CanvasPresenter = function(view, eventBus) {
	var self = this;
	this.view = view;
	this.map = null;
	var selectedNode = null;

	eventBus.subscribe("documentOpened", function(doc) {
		// console.log("draw doc", doc);
		self.map = doc.mindmap;
		view.drawMap(self.map);
	});

	eventBus.subscribe("deleteSelectedNodeRequested", function() {
		var node = selectedNode;
		if (node) {
			// remove from model
			var parent = node.getParent();
			parent.removeChild(node);

			// update view
			view.deleteNode(node);
			if (parent.isLeaf()) {
				view.removeCollapseButton(parent);
			}
		}
	});

	view.nodeSelected = function(node) {
		// deselect old node
		if (selectedNode) {
			view.deselectNode(selectedNode);
		}

		// select node and save reference
		view.selectNode(node);
		selectedNode = node;
	};

	view.nodeDragging = function() {
	};

	view.nodeDragged = function(node, offset) {
		// console.log(node.id, offset.toString());
		node.offset = offset;
	};

	view.collapseButtonClicked = function(node) {
		if (node.collapseChildren) {
			node.collapseChildren = false;
			view.openNode(node);
		} else {
			node.collapseChildren = true;
			view.closeNode(node);
		}
	};
};