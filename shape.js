class CutCornerSVG extends HTMLElement {
	static get observedAttributes() {
		return [
			"id",
			"width",
			"height",
			"rounded",
			"rounded-mobile",
			"corner-rounded",
			"corner-rounded-mobile",
			"corner-size",
			"corner-size-mobile",
			"corner",
			"stroke-width",
			"class",
			"filter",
			"image",
			"overlay",
		];
	}

	constructor() {
		super();
		this.attachShadow({ mode: "open" });

		this._width = 0;
		this._height = 0;
		this.resizeTimer = null;
		this._lastWindowHeight = window.innerHeight;
		this.globalResizeHandler = this.handleGlobalResize.bind(this);

		// Create a single measuring element for all CSS calculations
		this._measureElement = null;

		// Track mobile breakpoint state
		this.isMobile = window.innerWidth < 1025;
		this.mediaQueryHandler = this.handleMediaQueryChange.bind(this);
		this.mediaQuery = window.matchMedia("(max-width: 1024px)");

		// Component-specific ResizeObserver for direct size changes
		this.resizeObserver = new ResizeObserver((entries) => {
			// If on mobile, check if this is a small height change (likely search bar)
			if (this.isMobile) {
				const currentWindowHeight = window.innerHeight;
				const heightDiff = Math.abs(currentWindowHeight - this._lastWindowHeight);

				// If it's a small height change (< 150px) likely caused by browser UI, ignore it
				if (heightDiff > 0 && heightDiff < 150) {
					this._lastWindowHeight = currentWindowHeight;
					return;
				}
				this._lastWindowHeight = currentWindowHeight;
			}

			for (const entry of entries) {
				const newWidth = entry.contentRect.width;
				const newHeight = entry.contentRect.height;

				if ((this._width !== newWidth || this._height !== newHeight) && newWidth > 0 && newHeight > 0) {
					this._width = newWidth;
					this._height = newHeight;
					this.updateSVG();
				}
			}
		});

		this.init();

		//console.log("Shape created");
	}

	handleMediaQueryChange(e) {
		// Update mobile state when media query changes
		this.isMobile = e.matches;
		// Force redraw when breakpoint changes
		this.updateSVG();
	}

	getMeasureElement() {
		// First, make sure the helper container exists
		let helperContainer = document.getElementById("svg-elements-helpers");
		if (!helperContainer) {
			helperContainer = document.createElement("div");
			helperContainer.id = "svg-elements-helpers";
			helperContainer.style.cssText =
				"position:absolute;visibility:hidden;pointer-events:none;height:0;width:0;overflow:hidden;";
			document.body.appendChild(helperContainer);
		}

		// Then create or reuse the measure element
		if (!this._measureElement) {
			this._measureElement = document.createElement("div");
			this._measureElement.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;";
			helperContainer.appendChild(this._measureElement);
		}

		return this._measureElement;
	}

	handleGlobalResize() {
		// Clear any existing timer
		if (this.resizeTimer) {
			clearTimeout(this.resizeTimer);
		}

		// If on mobile, check if this is a small height change (likely search bar)
		if (this.isMobile) {
			// const currentWindowHeight = window.innerHeight;
			// const heightDiff = Math.abs(currentWindowHeight - this._lastWindowHeight);

			// // If it's a small height change (< 150px) likely caused by browser UI, ignore it
			// if (heightDiff > 0 && heightDiff < 150) {
			// 	this._lastWindowHeight = currentWindowHeight;
			// 	return;
			// }
			// this._lastWindowHeight = currentWindowHeight;
			return;
		}
		// Set a new timer for delayed recalculation
		this.resizeTimer = setTimeout(() => {
			// Force size check and update
			const width = this.offsetWidth;
			const height = this.offsetHeight;

			if (width > 0 && height > 0) {
				this._width = width;
				this._height = height;

				// Ensure corner-size gets properly reevaluated
				this.updateSVG();

				// Double-check update after a small delay to ensure CSS values are fully computed
				setTimeout(() => {
					this.updateSVG();
				}, 50);
			}
		}, 100);
	}

	init() {
		// Setup shadow DOM structure
		const template = document.createElement("template");
		template.innerHTML = `
		<style>
		  :host {
			display: block;
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			z-index: -1;
			box-sizing: border-box;
			contain: content;
		  }
		  
		  .svg-container {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
		  }
		  
		  svg {
			width: 100%;
			height: 100%;
			display: block;
		  }
		</style>
		<svg preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" class="svg-container">
		${
			this.getAttribute("filter")
				? `
			<path></path>
			<foreignObject x="0" y="0" width="100%" height="100%">
					  <div xmlns="http://www.w3.org/1999/xhtml"
						style="backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);clip-path:url(#customPathClip);height:100%;width:100%">
					  </div>
					</foreignObject>
					<defs>
					  <clipPath id="customPathClip">
						<path></path>
					  </clipPath>
					</defs>
		  `
				: this.hasAttribute("image")
					? `
				<path></path>
				<pattern id="${this.getAttribute("id")}-pattern" patternUnits="userSpaceOnUse" width="100%" height="100%">
				 	 <image href="${this.getAttribute("image")}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="${this.getAttribute("image-position") === "tl" ? "xMidYMin slice" : this.getAttribute("image-position") === "tr" ? "xMaxYMin slice" : this.getAttribute("image-position") === "bl" ? "xMinYMax slice" : this.getAttribute("image-position") === "br" ? "xMaxYMax slice" : "xMidYMid slice"}" />
					 ${this.getAttribute("overlay") && `<rect x="0" y="0" width="100%" height="100%" fill="black" opacity="${this.getAttribute("overlay")}" />`}
				</pattern>
				</pattern>
				`
					: `<path></path>`
		}
		</svg>
	  `;

		this.shadowRoot.appendChild(template.content.cloneNode(true));

		// Cache elements for quick access
		this.svgContainer = this.shadowRoot.querySelector(".svg-container");
		this.svg = this.shadowRoot.querySelector("svg");
		this.path = this.shadowRoot.querySelectorAll("path")[0];
		this.getAttribute("filter") && (this.clipPath = this.shadowRoot.querySelectorAll("path")[1]);
		this.content = this.shadowRoot.querySelector(".content");

		// Set initial path attributes
		this.path.setAttribute("stroke-width", this.strokeWidth);
	}

	connectedCallback() {
		// Listen for media query changes
		this.mediaQuery.addEventListener("change", this.mediaQueryHandler);

		// Observe host element for size changes
		this.resizeObserver.observe(this);

		// Add global window resize listener for more reliable detection
		window.addEventListener("resize", this.globalResizeHandler);

		// Initial size check - using multiple checks to ensure proper rendering
		// First check - immediate
		this.checkAndUpdateSize();

		this.classList.add("ready");

		// Second check - after first paint
		requestAnimationFrame(() => {
			this.checkAndUpdateSize();

			// Third check - after layout stabilization (especially for mobile)
			setTimeout(() => {
				this.checkAndUpdateSize();

				// Fourth check - longer delay for slower devices or complex layouts
				setTimeout(() => {
					this.checkAndUpdateSize();
				}, 500);
			}, 100);
		});
	}

	checkAndUpdateSize() {
		const width = this.offsetWidth;
		const height = this.offsetHeight;

		if (width > 0 && height > 0) {
			this._width = width;
			this._height = height;
			this.updateSVG();
		}
	}

	disconnectedCallback() {
		this.resizeObserver.unobserve(this);
		window.removeEventListener("resize", this.globalResizeHandler);
		this.mediaQuery.removeEventListener("change", this.mediaQueryHandler);

		if (this.resizeTimer) {
			clearTimeout(this.resizeTimer);
		}

		// Clean up the measurement element
		if (this._measureElement && this._measureElement.parentNode) {
			this._measureElement.parentNode.removeChild(this._measureElement);
			this._measureElement = null;
		}
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;

		if (name === "width") {
			this._width = Number(newValue) || 0;
			this.updateSVG();
		} else if (name === "height") {
			this._height = Number(newValue) || 0;
			this.updateSVG();
		} else if (
			name === "rounded" ||
			name === "rounded-mobile" ||
			name === "corner-rounded" ||
			name === "corner-rounded-mobile" ||
			name === "corner-size" ||
			name === "corner-size-mobile"
		) {
			this.updateSVG();
		} else if (name !== "class") {
			// For non-class attributes, update the SVG
			this.updateSVG();
		}
	}

	updateSVG() {
		if (!this.svg || !this.path || this._width === 0 || this._height === 0) return;

		// Make sure stroke width is a valid number
		const strokeWidth = isNaN(this.strokeWidth) ? 0 : this.strokeWidth;
		const halfStrokeWidth = strokeWidth / 2;

		this.svg.setAttribute(
			"viewBox",
			`${0} ${0} ${Math.ceil(this._width) - strokeWidth} ${Math.ceil(this._height) - strokeWidth}`,
		);

		// Force a reflow before setting the path
		this.svg.getBoundingClientRect();

		// Generate path and check if it's valid
		const pathData = this.generatePath();
		if (pathData && !pathData.includes("NaN")) {
			this.path.setAttribute("d", pathData);
			this.getAttribute("filter") && this.clipPath.setAttribute("d", pathData);

			if (this.hasAttribute("image")) {
				const image = new Image();
				image.src = this.getAttribute("image");
				image.onload = () => {
					this.path.setAttribute("fill", `url(#${this.getAttribute("id")}-pattern)`);
				};
			}
		} else {
			console.error("Invalid path data generated:", pathData);
		}

		if ((this.getAttribute("id") && this.getAttribute("id") !== "keep") || this.parentElement) {
			const parent = document.getElementById(this.getAttribute("id")) || this.parentElement;
			parent && parent.classList.remove("bg-white");
		}

		//console.log("Parent", this.parentElement);

		this.path.setAttribute("stroke-width", strokeWidth);

		// Ensure path is visible and properly scaled
		this.path.getBoundingClientRect();
	}

	get width() {
		return Number(this.getAttribute("width") || 0);
	}

	get height() {
		return Number(this.getAttribute("height") || 0);
	}

	get cornerRadius() {
		// Choose attribute based on mobile/desktop
		const attrName = this.isMobile && this.hasAttribute("rounded-mobile") ? "rounded-mobile" : "rounded";

		const roundedAttr = this.getAttribute(attrName);

		// Default value if not specified
		if (!roundedAttr) {
			return 20;
		}

		// If it appears to be a CSS function or has units
		if (
			isNaN(Number(roundedAttr)) ||
			roundedAttr.includes("clamp(") ||
			roundedAttr.includes("calc(") ||
			roundedAttr.includes("min(") ||
			roundedAttr.includes("max(") ||
			roundedAttr.includes("rem") ||
			roundedAttr.includes("em") ||
			roundedAttr.includes("px") ||
			roundedAttr.includes("vw") ||
			roundedAttr.includes("vh") ||
			roundedAttr.includes("var(")
		) {
			try {
				const measureEl = this.getMeasureElement();
				measureEl.style.width = roundedAttr;

				const computedSize = parseFloat(window.getComputedStyle(measureEl).width);

				// Check if result is valid
				return !isNaN(computedSize) ? computedSize : 20;
			} catch (e) {
				console.error("Error parsing rounded:", e);
				return 20; // Default value on error
			}
		}

		// Handle simple numeric values
		const numValue = Number(roundedAttr);
		return !isNaN(numValue) ? numValue : 20;
	}

	get cutCornerRadius() {
		// Choose attribute based on mobile/desktop
		const attrBaseName =
			this.isMobile && this.hasAttribute("corner-rounded-mobile") ? "corner-rounded-mobile" : "corner-rounded";

		// Check if corner-rounded attribute exists
		if (!this.hasAttribute(attrBaseName)) {
			// Fall back to the regular rounded value
			return this.cornerRadius;
		}

		const roundedAttr = this.getAttribute(attrBaseName);

		// If it appears to be a CSS function or has units
		if (
			isNaN(Number(roundedAttr)) ||
			roundedAttr.includes("clamp(") ||
			roundedAttr.includes("calc(") ||
			roundedAttr.includes("min(") ||
			roundedAttr.includes("max(") ||
			roundedAttr.includes("rem") ||
			roundedAttr.includes("em") ||
			roundedAttr.includes("px") ||
			roundedAttr.includes("vw") ||
			roundedAttr.includes("vh") ||
			roundedAttr.includes("var(")
		) {
			try {
				const measureEl = this.getMeasureElement();
				measureEl.style.width = roundedAttr;

				const computedSize = parseFloat(window.getComputedStyle(measureEl).width);

				// Check if result is valid
				return !isNaN(computedSize) ? computedSize : this.cornerRadius;
			} catch (e) {
				console.error("Error parsing corner-rounded:", e);
				return this.cornerRadius; // Fall back to cornerRadius on error
			}
		}

		// Handle simple numeric values
		const numValue = Number(roundedAttr);
		return !isNaN(numValue) ? numValue : this.cornerRadius;
	}

	get cutSize() {
		// Choose attribute based on mobile/desktop
		const attrName =
			this.isMobile && this.hasAttribute("corner-size-mobile") ? "corner-size-mobile" : "corner-size";

		// Get the corner size value
		const cornerSizeAttr = this.getAttribute(attrName);

		// Default size if not specified (60px)
		if (!cornerSizeAttr) {
			return Math.max(this.cornerRadius * 2, Math.min(Math.min(this._width, this._height) / 2, 60));
		}

		// For values with CSS units or clamp functions
		try {
			const measureEl = this.getMeasureElement();
			measureEl.style.width = cornerSizeAttr;

			const computedSize = parseFloat(window.getComputedStyle(measureEl).width);

			// Check if the computed size is valid
			if (isNaN(computedSize)) {
				console.error("Invalid computed corner-size:", computedSize);
				return Math.max(this.cornerRadius * 2, Math.min(Math.min(this._width, this._height) / 2, 60));
			}

			// Always return at least twice the corner radius, but no more than 90% of the smaller dimension
			return Math.max(this.cornerRadius * 2, Math.min(Math.min(this._width, this._height) * 0.9, computedSize));
		} catch (e) {
			console.error("Error parsing corner-size:", e);
			// Fallback to a default value
			return Math.max(this.cornerRadius * 2, Math.min(this._width, this._height) / 5);
		}
	}

	get cutPosition() {
		return this.getAttribute("corner") || "br";
	}

	get strokeWidth() {
		return Number(this.getAttribute("stroke-width") || 1);
	}

	generatePath() {
		const width = Math.ceil(this._width - this.strokeWidth);
		const height = Math.ceil(this._height - this.strokeWidth);

		// Calculate the regular corner radius with limits and ensure it's a valid number
		let cornerRadius = Math.ceil(this.cornerRadius);
		if (isNaN(cornerRadius)) cornerRadius = 0;

		// Calculate the cut corner radius with limits and ensure it's a valid number
		let cutRadius = Math.ceil(this.cutCornerRadius);
		if (isNaN(cutRadius)) cutRadius = 0;

		// Ensure cutSize is a valid number
		let cutSize = Math.ceil(this.cutSize);
		if (isNaN(cutSize)) cutSize = 60;

		const cutCornerPosition = this.cutPosition;

		const id = this.getAttribute("id");

		return this.generateRoundedPath(id, width, height, cornerRadius, cutRadius, cutSize, cutCornerPosition);
	}

	generateRoundedPath(id, width, height, cornerRadius, cutRadius, cutSize, cutCornerPosition) {
		let path = "";

		if (id && id === "button") {
			path = `M ${cornerRadius} 1`;
			path += ` L ${width - cornerRadius} 1`;
			path += ` Q ${width} 0 ${width - this.strokeWidth} ${cornerRadius}`;
			path += ` L ${width - this.strokeWidth} ${height - cutSize - cutRadius}`;
			path += ` Q ${width - this.strokeWidth} ${height - cutSize} ${width - cutRadius} ${height - cutSize + cutRadius}`;
			path += ` L ${width - cutSize + cutRadius} ${height - cutRadius - this.strokeWidth}`;
			path += ` Q ${width - cutSize} ${height - this.strokeWidth} ${width - cutSize - cutRadius} ${height - this.strokeWidth}`;
			path += ` L ${cornerRadius} ${height - this.strokeWidth}`;
			path += ` Q 0 ${height} 1 ${height - cornerRadius}`;
			path += ` L 1 ${cornerRadius}`;
			path += ` Q 0 0 ${cornerRadius} 1`;

			path += " Z";
			return path;
		}

		if (id && id === "solutions") {
			path = `M ${cornerRadius} 1`;
			path += ` L ${width - cutSize - cutRadius} 1`;
			path += ` Q ${width - cutSize} ${this.strokeWidth} ${width - cutSize + cutRadius} ${cutRadius + this.strokeWidth}`;
			path += ` L ${width - cutRadius} ${cutSize - cutRadius - this.strokeWidth}`;
			path += ` Q ${width - this.strokeWidth} ${cutSize} ${width - this.strokeWidth} ${cutSize + cutRadius}`;
			path += ` L ${width - this.strokeWidth} ${height - cornerRadius}`;
			path += ` Q ${width} ${height} ${width - cornerRadius} ${height - this.strokeWidth}`;
			path += ` L ${cornerRadius} ${height - this.strokeWidth}`;
			path += ` Q 0 ${height} 1 ${height - cornerRadius}`;
			path += ` L 1 ${cornerRadius}`;
			path += ` Q 0 0 ${cornerRadius} 1`;
			path += " Z";
			return path;
		}

		if (cutCornerPosition === "br") {
			path = `M ${cornerRadius} 0`;
			path += ` L ${width - cornerRadius} 0`;
			path += ` Q ${width} 0 ${width} ${cornerRadius}`;
			path += ` L ${width} ${height - cutSize - cutRadius}`;
			path += ` Q ${width} ${height - cutSize} ${width - cutRadius} ${height - cutSize + cutRadius}`;
			path += ` L ${width - cutSize + cutRadius} ${height - cutRadius}`;
			path += ` Q ${width - cutSize} ${height} ${width - cutSize - cutRadius} ${height}`;
			path += ` L ${cornerRadius} ${height}`;
			path += ` Q 0 ${height} 0 ${height - cornerRadius}`;
			path += ` L 0 ${cornerRadius}`;
			path += ` Q 0 0 ${cornerRadius} 0`;
		} else if (cutCornerPosition === "tr") {
			path = `M ${cornerRadius} 0`;
			path += ` L ${width - cutSize - cutRadius} 0`;
			path += ` Q ${width - cutSize} 0 ${width - cutSize + cutRadius} ${cutRadius}`;
			path += ` L ${width - cutRadius} ${cutSize - cutRadius}`;
			path += ` Q ${width} ${cutSize} ${width} ${cutSize + cutRadius}`;
			path += ` L ${width} ${height - cornerRadius}`;
			path += ` Q ${width} ${height} ${width - cornerRadius} ${height}`;
			path += ` L ${cornerRadius} ${height}`;
			path += ` Q 0 ${height} 0 ${height - cornerRadius}`;
			path += ` L 0 ${cornerRadius}`;
			path += ` Q 0 0 ${cornerRadius} 0`;
		} else if (cutCornerPosition === "bl") {
			path = `M ${cornerRadius} 0`;
			path += ` L ${width - cornerRadius} 0`;
			path += ` Q ${width} 0 ${width} ${cornerRadius}`;
			path += ` L ${width} ${height - cornerRadius}`;
			path += ` Q ${width} ${height} ${width - cornerRadius} ${height}`;
			path += ` L ${cutSize + cutRadius} ${height}`;
			path += ` Q ${cutSize} ${height} ${cutSize - cutRadius} ${height - cutRadius}`;
			path += ` L ${cutRadius} ${height - cutSize + cutRadius}`;
			path += ` Q 0 ${height - cutSize} 0 ${height - cutSize - cutRadius}`;
			path += ` L 0 ${cornerRadius}`;
			path += ` Q 0 0 ${cornerRadius} 0`;
		} else {
			path = `M ${cutSize + cutRadius} 0`;
			path += ` L ${width - cornerRadius} 0`;
			path += ` Q ${width} 0 ${width} ${cornerRadius}`;
			path += ` L ${width} ${height - cornerRadius}`;
			path += ` Q ${width} ${height} ${width - cornerRadius} ${height}`;
			path += ` L ${cornerRadius} ${height}`;
			path += ` Q 0 ${height} 0 ${height - cornerRadius}`;
			path += ` L 0 ${cutSize + cutRadius}`;
			path += ` Q 0 ${cutSize} ${cutRadius} ${cutSize - cutRadius}`;
			path += ` L ${cutSize - cutRadius} ${cutRadius}`;
			path += ` Q ${cutSize} 0 ${cutSize + cutRadius} 0`;
		}

		path += " Z";
		return path;
	}
}

customElements.define("wm-shape", CutCornerSVG);
