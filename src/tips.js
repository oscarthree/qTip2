// Tip coordinates calculator
function calculateTip(corner, width, height)
{
	var width2 = Math.floor(width / 2), height2 = Math.floor(height / 2),

	// Define tip coordinates in terms of height and width values
	tips = {
		bottomright:	[[0,0],				[width,height],		[width,0]],
		bottomleft:		[[0,0],				[width,0],				[0,height]],
		topright:		[[0,height],		[width,0],				[width,height]],
		topleft:			[[0,0],				[0,height],				[width,height]],
		topcenter:		[[0,height],		[width2,0],				[width,height]],
		bottomcenter:	[[0,0],				[width,0],				[width2,height]],
		rightcenter:	[[0,0],				[width,height2],		[0,height]],
		leftcenter:		[[width,0],			[width,height],		[0,height2]]
	};

	// Set common side shapes
	tips.lefttop = tips.bottomright; tips.righttop = tips.bottomleft;
	tips.leftbottom = tips.topright; tips.rightbottom = tips.topleft;

	return tips[corner];
}

function Tip(qTip, command)
{
	var self = this,
		opts = qTip.options.style.tip,
		elems = qTip.elements,
		tooltip = elems.tooltip,
		wrapper = elems.wrapper,
		cache = { 
			top: 0, 
			left: 0, 
			corner: { string: function(){} }
		},
		size = {
			width: opts.width,
			height: opts.height
		},
		color = { },
		border = opts.border || 0,
		method = opts.method || FALSE;

	self.corner = NULL;
	self.mimic = NULL;
	self.checks = {
		'^position.my|style.tip.(corner|mimic|method|border)': function() {
			// Re-determine tip type and update
			border = opts.border;

			// Make sure a tip can be drawn
			if(!self.init()) {
				self.destroy();
			}

			// Only update the position if mouse isn't the target
			else if(this.get('position.target') !== 'mouse') {
				this.reposition();
			}
		},
		'^style.tip.(height|width)': function() {
			// Re-set dimensions and redraw the tip
			size = {
				width: opts.width,
				height: opts.height
			};
			self.create();
			self.update();

			// Reposition the tooltip
			qTip.reposition();
		},
		'^style.(classes|widget)$': function() {
			self.detectColours();
			self.update();
		}
	};

	// Tip position method
	function position(corner)
	{
		var tip = elems.tip,
			corners  = ['left', 'right'],
			offset = opts.offset,
			precedance, precedanceOp;

		// Return if tips are disabled or tip is not yet rendered
		if(opts.corner === FALSE || !tip) { return FALSE; }

		// Inherit corner if not provided
		corner = corner || self.corner;

		// Cache precedances
		precedance = corner.precedance;
		precedanceOp = precedance === 'y' ? 'x' : 'y';

		// Setup corners to be adjusted
		corners[ precedance === 'y' ? 'push' : 'unshift' ]('top', 'bottom');

		// Calculate offset adjustments
		offset = Math.max(corner[ precedanceOp ] === 'center' ? offset : 0, offset);

		// Reet initial position
		tip.css({ top: '', bottom: '', left: '', right: '', margin: '' });
		
		// Adjust primary corners
		switch(corner[ precedance === 'y' ? 'x' : 'y' ])
		{
			case 'center':
				tip.css(corners[0], '50%').css('margin-'+corners[0], -Math.floor(size[ (precedance === 'y') ? 'width' : 'height' ] / 2) + offset);
			break;

			case corners[0]:
				tip.css(corners[0], offset);
			break;

			case corners[1]:
				tip.css(corners[1], offset);
			break;
		}

		// Determine secondary adjustments
		offset = size[ (precedance === 'x') ? 'width' : 'height' ];
		if(border) {
			tooltip.toggleClass('ui-tooltip-accessible', !tooltip.is(':visible'));
			offset -= parseInt(wrapper.css('border-' + corner[ precedance ] + '-width'), 10) || 0;
			tooltip.removeClass('ui-tooltip-accessible');
		}

		// VML adjustments
		if(method === 'vml' && (/bottom|right/).test(corner[ corner.precedance ])) {
			offset += border ? 1 : -1;
		}

		// Adjust secondary corners
		tip.css(corner[precedance], -offset);
	}

	function reposition(event, api, pos, viewport) {
		if(!elems.tip) { return; }

		var newCorner = $.extend({}, self.corner),
			precedance = newCorner.precedance === 'y' ? ['y', 'top', 'left', 'height', 'x'] : ['x', 'left', 'top', 'width', 'y'],
			adjusted = pos.adjusted,
			offset = [0, 0];

		// Make sure our tip position isn't fixed e.g. doesn't adjust with adjust.screen
		if(self.corner.fixed !== TRUE) {
			// Adjust tip corners
			if(adjusted.left) {
				newCorner.x = newCorner.x === 'center' ? (adjusted.left > 0 ? 'left' : 'right') : (newCorner.x === 'left' ? 'right' : 'left');
			}
			if(adjusted.top) {
				newCorner.y = newCorner.y === 'center' ? (adjusted.top > 0 ? 'top' : 'bottom') : (newCorner.y === 'top' ? 'bottom' : 'top');
			}

			// Update and redraw the tip if needed
			if(newCorner.string() !== cache.corner.string() && (cache.top !== adjusted.top || cache.left !== adjusted.left)) {
				self.update(newCorner);
			}
		}

		// Setup offset adjustments
		offset[0] = border ? parseInt(wrapper.css('border-' + newCorner[ precedance[0] ] + '-width'), 10) || 0 : (method === 'vml' ? 1 : 0);
		offset[1] = Math.max(newCorner[ precedance[4] ] === 'center' ? opts.offset : 0, opts.offset);

		// Adjust tooltip position in relation to tip element
		pos[ precedance[1] ] += (newCorner[ precedance[0] ] === precedance[1] ? 1 : -1) * (size[ precedance[3] ] - offset[0]);
		pos[ precedance[2] ] -= (newCorner[ precedance[4] ] === precedance[2] || newCorner[ precedance[4] ] === 'center' ? 1 : -1) * offset[1];

		// Cache details
		cache.left = adjusted.left;
		cache.top = adjusted.top;
		cache.corner = newCorner;
	}

	$.extend(self, {
		init: function()
		{
			var ie = $.browser.msie,
				enabled = self.detectCorner(),
				center = self[self.mimic ? 'mimic' : 'corner'].string().indexOf('center') > -1;

			// Determine tip corner and type
			if(enabled) {
				// Check if rendering method is possible and if not fall back
				if(method === TRUE) {
					method = $('<canvas />')[0].getContext ? 'canvas' : ie && (center || size.height !== size.width) ? 'vml' : 'polygon';
				}
				else {
					if(method === 'canvas') {
						method = ie ? 'vml' : !$('<canvas />')[0].getContext ? 'polygon' : 'canvas';
					}
					else if(method === 'polygon') {
						method = ie && center ? 'vml' : method;
					}
				}

				// Create a new tip
				self.create();
				self.detectColours();
				self.update();

				// Bind update events
				tooltip.unbind('.qtip-tip').bind('tooltipmove.qtip-tip', reposition);
			}

			return enabled;
		},

		detectCorner: function()
		{
			var corner = opts.corner,
				at = qTip.options.position.at,
				my = qTip.options.position.my;
				if(my.string) { my = my.string(); }

			// Detect corner and mimic properties
			if(corner === FALSE || (my === FALSE && at === FALSE)) {
				return FALSE;
			}
			else {
				if(corner === TRUE) {
					self.corner = new $.fn.qtip.plugins.Corner(my);
				}
				else if(!corner.string) {
					self.corner = new $.fn.qtip.plugins.Corner(corner);
					self.corner.fixed = TRUE;
				}
			}

			return self.corner.string() !== 'centercenter';
		},

		detectColours: function() {
			var tip = elems.tip,
				corner = self.corner,
				precedance = self.corner[ self.corner.precedance ],
				borderSide = 'border-' + precedance + '-color',
				invalid = /rgba?\(0, 0, 0(, 0)?\)|transparent/i,
				isTitleTop = elems.titlebar.length && corner.y === 'top',
				elemFill = isTitleTop ? elems.titlebar : elems.wrapper,
				elemBorder = isTitleTop ? elems.wrapper : qTip.options.style.widget ? elems.content : elems.wrapper;

			// Detect tip colours
			color.fill = tip.css({ backgroundColor: '', border: '' }).css('background-color') || 'transparent';
			color.border = tip.get(0).style ? tip.get(0).style['border' + precedance.charAt(0) + precedance.substr(1) + 'Color'] : tip.css(borderSide) || 'transparent';

			// Make sure colours are valid and reset background and border properties
			if(invalid.test(color.fill)) { color.fill = elemFill.css(border ? 'background-color' : borderSide); }
			if(!color.border || invalid.test(color.border)) { color.border = elemBorder.css(borderSide) || color.fill; }

			$('*', tip).add(tip).css('background-color', 'transparent').css('border', 0);
		},

		create: function()
		{
			var width = size.width,
				height = size.height;

			// Create tip element and prepend to the tooltip if needed
			if(elems.tip){ elems.tip.remove(); }
			elems.tip = $('<div class="ui-tooltip-tip" />')
				.toggleClass('ui-widget-content', qTip.options.style.widget)
				.css(size).prependTo(tooltip);

			// Create tip element
			switch(method)
			{
				case 'canvas':
					// save() as soon as we create the canvas element so FF2 doesn't bork on our first restore()!
					$('<canvas height="'+height+'" width="'+width+'" />').appendTo(elems.tip)[0].getContext('2d').save(); 
				break;

				case 'vml':
					elems.tip.html('<vml:shape coordorigin="0 0" coordsize="'+width+' '+height+'" stroked="' + !!border + '" ' +
						' style="behavior:url(#default#VML); display:inline-block; antialias:TRUE; position: absolute; ' +
						' top:0; left:0; width:'+width+'px; height:'+height+'px; vertical-align:'+self.corner.y+';">' +

						'<vml:stroke weight="' + (border-2) + 'px" joinstyle="miter" miterlimit="10" ' + 
							' style="behavior:url(#default#VML); display:inline-block;" />' +

						'</vml:shape>');
				break;

				case 'polygon':
					elems.tip.append('<div class="ui-tooltip-tip-inner" />').append(border ? '<div class="ui-tooltip-tip-border" />' : '');
				break;
			}

			return self;
		},

		update: function(corner)
		{
			var tip = elems.tip,
				width = size.width,
				height = size.height,
				regular = 'px solid ',
				transparent = 'px dashed transparent', // Dashed IE6 border-transparency hack. Awesome!
				i = border > 0 ? 0 : 1,
				translate = Math.ceil(border / 2 + 0.5),
				mimic = opts.mimic,
				factor, context, path, coords, inner, round;

			// Re-determine tip if not already set
			if(!corner) { corner = self.corner; }

			// Use corner property if we detect an invalid mimic value
			if(mimic === FALSE) { mimic = corner; }

			// Otherwise inherit mimic properties from the corner object as necessary
			else {
				mimic = new $.fn.qtip.plugins.Corner(mimic);
				mimic.precedance = corner.precedance;

				if(mimic.x === 'inherit') { mimic.x = corner.x; }
				else if(mimic.y === 'inherit') { mimic.y = corner.y; }
				else if(mimic.x === mimic.y) {
					mimic[ corner.precedance ] = corner[ corner.precedance ];
				}
			}

			// Determine what type of rounding to use so we get pixel perfect precision!
			round = Math[ /b|r/.test(mimic[ mimic.precedance === 'y' ? 'x' : 'y' ]) ? 'ceil' : 'floor' ];

			// Find inner child of tip element
			inner = tip.children();

			// Create tip element
			switch(method)
			{
				case 'canvas':
					// Grab canvas context and clear it
					context = inner.get(0).getContext('2d');
					if(context.restore) { context.restore(); }
					context.clearRect(0,0,3000,3000);

					// Grab tip coordinates
					coords = calculateTip(mimic.string(), width, height);

					// Draw the canvas tip (Delayed til after DOM creation)
					for(i; i < 2; i++) {
						// Save and translate canvas origin
						if(i) {
							context.save();
							context.translate(
								round((mimic.x === 'left' ? 1 : mimic.x === 'right' ? -1 : 0) * (border + 1) * (mimic.precedance === 'y' ? 0.5 : 1)),
								round((mimic.y === 'top' ? 1 : mimic.y === 'bottom' ? -1 : 0) * (border + 1) * (mimic.precedance === 'x' ? 0.5 : 1))
							);
						}

						context.beginPath();
						context.moveTo(coords[0][0], coords[0][1]);
						context.lineTo(coords[1][0], coords[1][1]);
						context.lineTo(coords[2][0], coords[2][1]);
						context.closePath();
						context.fillStyle = color[ i ? 'fill' : 'border' ];
						context.fill();
					}
					break;

				case 'vml':
					// Determine tip coordinates based on dimensions
					coords = calculateTip(mimic.string(), width, height);

					// Create coordize and tip path using tip coordinates
					path = 'm' + coords[0][0] + ',' + coords[0][1] + ' l' + coords[1][0] +
						',' + coords[1][1] + ' ' + coords[2][0] + ',' + coords[2][1] + ' xe';

					inner.attr({ 'path': path, 'fillcolor': color.fill });

					if(border) {
						inner.children().attr('color', color.border);

						if(mimic.precedance === 'y') {
							inner.css('top', (mimic.y === 'top' ? 1 : -1) * (border - 2));
							inner.css('left', (mimic.x === 'left' ? 1 : -2));
						}
						else {
							inner.css('left', (mimic.x === 'left' ? 1 : -1) * (border - 2));
							inner.css('top', (mimic.y === 'top' ? 1 : -2));
						}

					}
					break;

				case 'polygon':
					// Determine border translations
					if(mimic.precedance === 'y') {
						factor = width > height ? 1.5 : width < height ? 5 : 2.2;
						translate = [
							mimic.x === 'left' ? translate : mimic.x === 'right' ? -translate : 0,
							Math.floor(factor * translate * (mimic.y === 'bottom' ? -1 : 1) * (mimic.x === 'center' ? 0.8 : 1))
						];
					}
					else {
						factor = width < height ? 1.5 : width > height ? 5 : 2.2;
						translate = [
							Math.floor(factor * translate * (mimic.x === 'right' ? -1 : 1) * (mimic.y === 'center' ? 0.9 : 1)),
							mimic.y === 'top' ? translate : mimic.y === 'bottom' ? -translate : 0
						];
					}

					inner.removeAttr('style').each(function(i) {
						// Determine what border corners/colors to set
						var toSet = {
								x: mimic.precedance === 'x' ? (mimic.x === 'left' ? 'right' : 'left') : mimic.x,
								y: mimic.precedance === 'y' ? (mimic.y === 'top' ? 'bottom' : 'top') : mimic.y
							},
							path = mimic.x === 'center' ? ['left', 'right', toSet.y, height, width] : ['top', 'bottom', toSet.x, width, height],
							col = color[!i && border ? 'border' : 'fill'];

						if(i) { 
							$(this).css({ 'position': 'absolute', 'z-index': 1, 'left': translate[0], 'top': translate[1] });
						}

						// Setup borders based on corner values
						if(mimic.x === 'center' || mimic.y === 'center') {
							$(this).css('border-' + path[2], path[3] + regular + col)
								.css('border-' + path[0], Math.floor(path[4] / 2) + transparent)
								.css('border-' + path[1], Math.floor(path[4] / 2) + transparent);
						}
						else {
							$(this).css('border-width', Math.floor(height / 2) + 'px ' + Math.floor(width / 2) + 'px')
								.css('border-' + toSet.x, Math.floor(width / 2) + regular + col)
								.css('border-' + toSet.y, Math.floor(height / 2) + regular + col);
						}
					});
					break;
			}

			// Update position
			position(corner);

			return self;
		},

		destroy: function()
		{
			// Remove previous tip if present
			if(elems.tip) {
				elems.tip.remove();
			}

			// Remove bound events
			tooltip.unbind('.qtip-tip');
		}
	});
}

$.fn.qtip.plugins.tip = function(qTip)
{
	var api = qTip.plugins.tip,
		opts = qTip.options.style.tip;

	// Make sure tip options are present
	if(opts && opts.corner) {
		// An API is already present,
		if(api) {
			return api;
		}
		// No API was found, create new instance
		else {
			qTip.plugins.tip = new Tip(qTip);
			qTip.plugins.tip.init();

			return qTip.plugins.tip;
		}
	}
};

// Initialize tip on render
$.fn.qtip.plugins.tip.initialize = 'render';

// Setup plugin sanitization options
$.fn.qtip.plugins.tip.sanitize = function(options)
{
	try {
		var opts = options.style.tip;
		if(typeof opts !== 'object'){ options.style.tip = { corner: opts }; }
		if(!(/string|boolean/i).test(typeof opts.corner)) { opts.corner = true; }
		if(typeof opts.method !== 'string'){ opts.method = TRUE; }
		if(!(/canvas|polygon/i).test(opts.method)){ opts.method = TRUE; }
		if(typeof opts.width !== 'number'){ delete opts.width; }
		if(typeof opts.height !== 'number'){ delete opts.height; }
		if(typeof opts.border !== 'number'){ delete opts.border; }
		if(typeof opts.offset !== 'number'){ delete opts.offset; }
	}
	catch(e) {}
};

// Extend original qTip defaults
$.extend(TRUE, $.fn.qtip.defaults, {
	style: {
		tip: {
			corner: TRUE,
			mimic: FALSE,
			method: TRUE,
			width: 9,
			height: 9,
			border: 0,
			offset: 0
		}
	}
});