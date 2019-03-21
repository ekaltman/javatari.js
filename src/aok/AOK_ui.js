//Just adding a general asset function
//if we need more utils I'll create a separate file
function assert(condition, message){
    if(!condition){
	throw new Error(message);
    }
}



//component to manage UI functions of emulator
//and receive information from AOK
jt.aokUI= function(uiElement, atariConsole){

    //hook up aok instance
    var aok = atariConsole.retrieveAOK();

    //setup ui elements
    var editorElement = document.createElement("div");
    editorElement.setAttribute("id", "aok-ui-editor");

    var loadCodeButton = document.createElement("button");
    var loadCodeButtonTextNode = document.createTextNode("Load Editor Code");
    loadCodeButton.setAttribute("id", "aok-ui-run-code-button");
    loadCodeButton.appendChild(loadCodeButtonTextNode);

    var standardOutput = document.createElement("div");
    standardOutput.setAttribute("id", "aok-ui-standard-output");
    standardOutput.style.fontFamily = "courier";

    //tab interface setup
    //based on: https://www.w3schools.com/howto/howto_js_tabs.asp

    var tabHolder = document.createElement("div");
    var codeTab = document.createElement("div");
    var sheetTab = document.createElement("div");
    var sheetExportTab = document.createElement("div");
    var visTab = document.createElement("div");
    var codeTabButton = document.createElement("button");
    var sheetTabButton = document.createElement("button");
    var sheetExportTabButton = document.createElement("button");
    var visTabButton = document.createElement("button");


    tabHolder.style.height = "16px";

    codeTab.setAttribute("id", "aok-ui-codetab");
    sheetTab.setAttribute("id", "aok-ui-sheettab");
    sheetExportTab.setAttribute("id", "aok-ui-sheet-export-tab");
    visTab.setAttribute("id", "aok-ui-vistab");

    codeTab.className = "aok-ui-tabcontent";
    sheetTab.className = "aok-ui-tabcontent";
    sheetExportTab.className = "aok-ui-tabcontent";
    visTab.className = "aok-ui-tabcontent";

    codeTabButton.className = "aok-ui-tablinks";
    sheetTabButton.className = "aok-ui-tablinks";
    sheetExportTabButton.className = "aok-ui-tablinks";
    visTabButton.className = "aok-ui-tablinks";

    codeTabButton.addEventListener("click", (e) => { openTab(e, "aok-ui-codetab"); });
    sheetTabButton.addEventListener("click", (e) => { openTab(e, "aok-ui-sheettab");});
    sheetExportTabButton.addEventListener("click", (e) => { openTab(e, "aok-ui-sheet-export-tab");});
    visTabButton.addEventListener("click", (e) => { openTab(e, "aok-ui-vistab");});

    codeTabButton.innerHTML = "Code";
    sheetTabButton.innerHTML = "Sheet";
    sheetExportTabButton.innerHTML = "Export";
    visTabButton.innerHTML = "Vis";


    //Tab Controls

    function openTab(event, tabname){
	var i, tabcontent, tablinks;

	tabcontent = document.getElementsByClassName("aok-ui-tabcontent");
	for(i = 0; i < tabcontent.length; i++){
	    tabcontent[i].style.display = "none";
	}

	tablinks = document.getElementsByClassName("aok-ui-tablinks");
	for(i = 0; i < tablinks.length; i++){
	    tablinks[i].className = tablinks[i].className.replace(" active", "");
	}

	document.getElementById(tabname).style.display = "block";
	event.currentTarget.className += " active";
    }

    // Just load the current code for now
    loadCodeButton.addEventListener("click", function(){
	aok.newfile(editor.getValue());
    });

    var hasFileSelector = false;
    // Currently setting up file loader to have only one file at a time
    if (window.File && window.FileReader && window.FileList && window.Blob){
	var fileSelector = document.createElement("input");
	hasFileSelector = true;
	fileSelector.setAttribute("type", "file");
	fileSelector.setAttribute("id", "ui-file-input");
	fileSelector.addEventListener("change", readFile, false);


	function readFile(event){
	    var file = event.target.files[0];

	    if (!file){
		console.log("Failed to load selected file.");
	    }else{
		var r = new FileReader();
		r.onload = function(e) {
		    var textContents = e.target.result;
		    editor.setValue(textContents);
		};
		r.readAsText(file);
	    }
	}

    }

    //Memory Visualization Component
    var memVisHolder = document.createElement("div");
    var memVisGridWidth = 16;
    var memVisGridHeight = 8;
    var memVisGridSquarePxSize = 40;
    var memVisGridSourceArray = randomNoise(memVisGridWidth, memVisGridHeight);
    var memVisGridElementArray = [];

    memVisHolder.style.borderStyle = "solid";
    memVisHolder.style.borderWidth= "thin";
    memVisHolder.style.width = memVisGridSquarePxSize * memVisGridWidth + "px";
    memVisHolder.style.height = memVisGridSquarePxSize * memVisGridHeight + "px";
    memVisHolder.style.position = "relative";


    function randomNoise(w, h){
	var gridValues = [];
	for (var i = 0; i < w * h; i++){
	    gridValues.push(Math.random());
	}
	return gridValues;
    }

    function grayScaleFloatNumberMapColor(value){
	var color = "#";
	var scaledValue = Math.floor(value * 255).toString(16);
	if (scaledValue < 10){
	    scaledValue = "0" + scaledValue;
	}
	return color + scaledValue + scaledValue + scaledValue;
    }

    function grayScaleFloatNumberMapColor(value){
	var color = "#";
	var scaledValue = Math.floor(value * 255).toString(16);
	if (scaledValue < 10){
	    scaledValue = "0" + scaledValue;
	}
	return color + scaledValue + scaledValue + scaledValue;
    }

    function grayScaleNumberMapColor(value){
	var color = "#";
	var scaledValue = value.toString(16);
	if (scaledValue < 10){
	    scaledValue = "0" + scaledValue;
	}
	return color + scaledValue + scaledValue + scaledValue;
    }

    var i;
    for (i = 0; i < memVisGridSourceArray.length; i++){
	memVisGridSourceArray[i] = grayScaleNumberMapColor(memVisGridSourceArray[i]);
	var element = document.createElement('div');
	element.style.backgroundColor = memVisGridSourceArray[i];
	element.style.height = memVisGridSquarePxSize + "px";
	element.style.width = memVisGridSquarePxSize + "px";
	element.style.position = "absolute";

	var left = (i % memVisGridWidth) *  memVisGridSquarePxSize;
	element.style.left = "" + left + "px";

	var topValue = Math.floor(i / memVisGridWidth) *  memVisGridSquarePxSize;
	element.style.top = "" + topValue + "px";
	element.style.textAlign = "center";
	element.style.verticalAlign = "middle";
	element.style.fontFamily = "courier";

	memVisGridElementArray.push(element);

	memVisHolder.appendChild(element);
    }

    function applyNewGrayScaleColorMap(elementArray, values){
	assert(elementArray.length === values.length, "Element array and values array do not match");
	for (var i = 0; i < elementArray.length; i++){
	    elementArray[i].style.backgroundColor = grayScaleNumberMapColor(values[i]);
	}
    }

    function applyNewTextValuesMap(elementArray, values){
	assert(elementArray.length === values.length, "Element array and values array do not match");
	for (var i = 0; i < elementArray.length; i++){
	    elementArray[i].innerHTML = values[i].toString(16);
	    elementArray[i].style.backgroundColor = grayScaleNumberMapColor(values[i]);
	}
    }


    // Spreadsheet Component
    var sheetModel = {sheetData: [],
		      frameUpdateList: [], instrUpdateList: [], //update lists for active cells
		      pendingValueUpdates:{}, pendingStyleUpdates:{}, //update dicts for on requestAnim updates
		      pendingUpdate: false}; //pending update flag for requestAnim updates
    var coordLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var initMaxNumberColumns = 26;
    var initMaxNumberRows = 50;
    var rowHeaderCellWidth = 20;
    var columnHeaderCellHeight = 24;
    var cellHeight = 24;
    var cellWidth = 64;

    var sheetCellEditor = document.createElement("input");
    sheetCellEditor.style.width = "600px";
    sheetCellEditor.style.height = "24px";
    sheetCellEditor.style.fontFamily = "Courier";
    sheetCellEditor.style.fontSize = "20px";
    sheetCellEditor.style.marginBottom = "12px";
    sheetCellEditor.style.marginTop = "6px";

    var sheetHolder = document.createElement("div");
    sheetHolder.style.position = "relative";
    sheetHolder.style.overflow = "scroll";
    sheetHolder.style.width = "640px";
    sheetHolder.style.height = "360px";


    var sheetColorTable = {
	red: "rgb(255,0,0)",
	green: "rgb(0,255,0)",
	blue: "#rgb(0,0,255)",
	yellow: "rgb(255,255,0)",
	purple: "rgb(128,0,128)",
	gray: "rgb(128,128,128)",
	grey: "rgb(128,128,128)",
	pink: "rgb(255, 192, 203)"
    };

    function columnNumberToLetter(num){
	return coordLetters[num];
    }

    //fix column addressing issue
    function columnLetterToNumber(letter){
	return coordLetters.indexOf(letter);
    }

    // Spreadsheet cell parsing functions

    // Sheet function table for argument types and function linkage
    var sheetFuncTable = {
	heat: {args: 2, argTypes: ['location', 'color'], func_exec: sheetHeatFunc},
	frame: {args: 1, argTypes: ['location'], func_exec: (location, cell) => sheetLocUpdateFunc(location, "frame", cell)},
	atariColor: {args: 1, argTypes: ['location'], func_exec: sheetAtariColorFunc}
    };

    // Sheet Argument Type table for argument objects to functions
    // Example: heat function expects both location and color
    // so from regex groups, we get object:
    // {location:
    //    {
    //       component: XX,
    //       location: YY
    //    },
    //  color:
    //    {
    //       web: <colorName>,
    //       rgb: #<colorValue>
    //    }
    //}
    var sheetArgTypeRegex = {
	location: /at:(?<component>\w+)@(?<location>\w+)(,|\))?/,
	color: /^(?<web>red|blue|green|yellow|gray|grey|purple|pink)?|^(?<rgb>#[0-9A-F]{6})?/
    };

    function parseCellExpression(expression, cell){

	// Parses according to spec document:
	// heat(location, colorVertical) -> heatmap applied to specific location (ram@0xFF, cpu@A, etc.) with specific seed color (either basic web colors or RGB)
	// at:{memorySource}@{address}, updates on instruction as default, to align with language
	// frame(location), updates location data on frame instead of instruction
	// changed:{memorySource}@{address}, updates on change signal (may not do this)
	// eval(location) => style object, arbitrary function that alters cell styling / text

	var match, funcName, memorySource, address, inExpression;
	var returnObj = {style: "", value: expression, updateFunction: null}; //initial fall through values

	var funcMatch = /(^\w+)\(/; //match on function name
	var at_re = /^at/; //match on at:
	var changed_re = /^changed/; // match on changed:
	if((at_re.exec(expression)) !== null){
	    match = sheetArgTypeRegex.location.exec(expression);
	    if(!match){
		fireAOKLogEvent("SHEET_ERROR in 'at' declaration");
		returnObj.value = "ERROR";
	    }else{
		returnObj = sheetLocUpdateFunc(match.groups, "instr", cell);
	    }
	}else if((changed_re.exec(expression)) !== null){
	    // changed expression parsing
	}else if((match = funcMatch.exec(expression)) !== null){
	    // match function and deal with execution
	    funcName = match[1];
	    inExpression = expression.slice(match[0].length);
	    if(sheetFuncTable[funcName]){
		var argCount = 0;
		var argMatch;
		var funcArgs = [];
		var argError;
		while(argCount < sheetFuncTable[funcName].args ){
		    // look up the argument regex and parse for this argument
		    if((argMatch = sheetArgTypeRegex[sheetFuncTable[funcName].argTypes[argCount]].exec(inExpression)) !== null) {
			funcArgs.push(argMatch.groups);
		    }else{
			argError = true;
			break;
		    }
		    inExpression = inExpression.slice(argMatch[0].length);
		    argCount++;
		}

		if(!argError){
		    funcArgs.push(cell); //cell reference is last argument to functions
		    try{
			returnObj = sheetFuncTable[funcName].func_exec.apply(null, funcArgs);
		    }
		    catch(err){
			fireAOKLogEvent("SHEET_ERROR in Function declaration: " + funcName);
			returnObj.value = "ERROR!";
		    }
		}else{
		    fireAOKLogEvent("SHEET_ERROR - Argument Error in '" + funcName +"' declaration");
		    returnObj.value = "ERROR!";
		}
	    }else{
		fireAOKLogEvent("SHEET_ERROR - Function name: '" + funcName + "' not recognized.");
		returnObj.value = "ERROR!";
	    }
	}

	if(expression === ""){
	    sheetRemoveFromUpdateLists(cell.id);
	}

	return returnObj;

    }

    function sheetHeatFunc(location, color, cell){
	var component, loc, baseColor;
	component = location.component;
	loc = location.location;
	if(color.web){
	    baseColor = sheetColorTable[color.web];
	}else if(color.rgb){
	}

	//convert color to rgb

	//map color to location value

    }

    // from https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors/13542669
    // p is percent of shade from -1.0 to 1.0, black to white
    // c is color in rgb(X,X,X)
    const RGB_Log_Shade=(p,c)=>{
    var i=parseInt,r=Math.round,[a,b,c,d]=c.split(","),P=p<0,t=P?0:p*255**2,P=P?1+p:1-p;
    return"rgb"+(d?"a(":"(")+r((P*i(a[3]=="a"?a.slice(5):a.slice(4))**2+t)**0.5)+","+r((P*i(b)**2+t)**0.5)+","+r((P*i(c)**2+t)**0.5)+(d?","+d:")");
    };

    function sheetAtariColorFunc(location, cell){
    }

    function sheetLocUpdateFunc(location, updateLoop, cell){
	var component, loc, lookup;
	component = location.component;
	loc = location.location;

	if(component == "ram"){
	    lookup = function(location){
		return eval("() => { return aokui_ram.read(parseInt(" + location + "))}");
	    }(loc);
	}else if(component == "tia"){
	    lookup = aokui_getfunc("tia", loc);
	}else if(component == "cpu"){
	    lookup = aokui_getfunc("cpu", loc);
	}

	updateFunction = function(c){
	    return () => {
		sheetScheduleUpdate(c, lookup().toString(16));
	    };
	}(cell);

	if(updateLoop == "instr"){
	    sheetModel.instrUpdateList.push(cell);
	}else if(updateLoop == "frame"){
	    sheetModel.frameUpdateList.push(cell);
	}

	return {
	    updateFunction: updateFunction,
	    style: "",
	    value: "at:" + component + "@" + loc
	};
    }

    function applyCellStyle(styleObject, cellElement){
    }

    function sheetScheduleUpdate(cell, newValue){
	var currentValue = cell.getValue();
	if(newValue === currentValue) //if the value hasn't changed, there's no value to update
	    return null;

	sheetModel.pendingValueUpdates[cell.id] = newValue;
	if(!sheetModel.pendingUpdate){
	    sheetModel.pendingUpdate = true;
	    window.requestAnimationFrame(updateSheetAnimFrame);
	}

	return null;
    }

    function updateSheetAnimFrame(){
	for(var key in sheetModel.pendingValueUpdates){
	    var [col, row] = key.split("_"); //destructing declaration, new to ES6
	    sheetModel.sheetData[row][col].setValue(sheetModel.pendingValueUpdates[key]);
	}
	sheetModel.pendingValueUpdates = {};
	sheetModel.pendingUpdate = false;
    }

    // Could optimize this to look per list and such, probably not needed
    function sheetRemoveFromUpdateLists(cellID){
	var removed = false;
	for(var i = 0; i < sheetModel.frameUpdateList.length; i++){
	    if(sheetModel.frameUpdateList[i].id === cellID){
		sheetModel.frameUpdateList.splice(i, 1);
		removed = true;
		break;
	    }
	}
	if(removed){
	    return true;
	}

	for(var i = 0; i < sheetModel.instrUpdateList.length; i++){
	    if(sheetModel.instrUpdateList[i].id === cellID){
		sheetModel.instrUpdateList.splice(i, 1);
		return true;
	    }
	}

	return false;
    }

    //Spreadsheet Cell object

    function CellData(row, column, element){
	const selectedCellClass = " aok-ui-sheet-table-selected-cell";
	const editingCellClass = " aok-ui-sheet-table-edited-cell";
	var self = this;
	self.currentExpression = "";
	self.value = "";
	self.previousExpressions = [];
	self.nextExpressions = [];
	self.column = column;
	self.row = row;
	self.element = element;
	self.selected = false;
	self.editing = false;
	self.updateFunc = null;
	self.state = null;
	self.id = self.column + "_" + self.row;
	self.updating = false;

	return {
	    isSelected: () => self.selected,
	    isEditing: () => self.editing,
	    column: self.column,
	    row: self.row,
	    id: self.id,
	    element: () => self.element,
	    setExpression: function(expression){
		if(self.currentExpression !== expression){
		    self.previousExpressions.push(self.currentExpression);
		    self.currentExpression = expression;
		    self.state = parseCellExpression(self.currentExpression, getCellFromSheetData(sheetModel.sheetData, self.row, self.column)); // getCellFromSheetData needed to get CellData function closure
		    if(self.state.style){
			applyCellStyle(self.state.style, self.element);
		    }
		    if(self.state.updateFunction){
			self.updateFunc = self.state.updateFunction;
		    }
		    self.element.innerHTML = self.state.value;
		}
	    },
	    getExpression: () => self.currentExpression,
	    select: function(){
		if(!self.selected){
		    self.element.className += selectedCellClass;
		    self.selected = true;
		}
	    },
	    unselect: function(){
		if(self.selected){
		    self.element.className = self.element.className.replace(selectedCellClass, "");
		    self.selected = false;
		}
	    },
	    edit: function(){
		if(!self.editing){
		    if(!self.selected) self.selected = true; // editing a cell is also selecting it
		    self.element.className += editingCellClass;
		    self.editing = true;
		}
	    },
	    stopEdit: function(){
		if(self.editing){
		    if(self.selected) self.selected = false;
		    self.editing = false;
		    self.element.className = self.element.className.replace(editingCellClass, "");
		}
	    },
	    update: function(){
		if(self.updateFunc){
		    self.updateFunc();
		}else{
		    fireAOKLogEvent("SHEET ERROR - Cell: "+ columnNumberToLetter(self.column) + "_" + self.row + " has no update function.");
		}
	    },
	    setValue: (value) => {
		self.value = value;
		self.state.value = value;
		self.element.innerHTML = value;
	    },
	    getValue: () => self.value
	};
    };

    // Setup spreadsheet model and element set

    var sheetTableElement = document.createElement("table");
    sheetTableElement.setAttribute("id", "aok-ui-sheet-table");
    sheetTableElement.style.border = "1px solid";
    sheetTableElement.style.borderCollapse = "collapse";
    sheetTableElement.style.width = initMaxNumberColumns * cellWidth + rowHeaderCellWidth + "px";
    sheetTableElement.style.height = initMaxNumberRows * cellHeight + columnHeaderCellHeight + "px";
    sheetHolder.appendChild(sheetTableElement);
    var headerRow = document.createElement("tr");
    var topLeftCell = document.createElement("th");
    headerRow.appendChild(topLeftCell);
    for (var i = 0; i < initMaxNumberColumns; i++){
	var headerData = document.createElement("th");
	headerData.setAttribute("id", "aok-ui-sheet-table-header-col-" + i);
	headerData.className = "aok-ui-sheet-table-col-header-cell";
	headerData.innerHTML = "" + columnNumberToLetter(i);
	headerData.style.width = cellWidth + "px";
	headerData.style.height = columnHeaderCellHeight + "px";
	headerData.style.border = "1px solid";
	headerData.style.borderCollapse = "collapse";
	headerRow.appendChild(headerData);
    }

    sheetTableElement.appendChild(headerRow);

    for (var i = 0; i < initMaxNumberRows + 1; i++){ // adding one for header row
	var currentRowElement = document.createElement("tr");
	if(sheetModel.sheetData[i] === undefined){
	    sheetModel.sheetData[i] = [];
	}

	sheetTableElement.appendChild(currentRowElement);

	for (var j = 0; j < initMaxNumberColumns + 1; j++){ //adding one for header column
	    var element = document.createElement("td");
	    element.style.height = cellHeight + "px";
	    element.style.border = "1px solid";
	    element.style.borderCollapse = "collapse";
	    if(j == 0){ // we are in header column
		element.setAttribute("id", "aok-ui-sheet-table-header-row-" + i);
		element.className = "aok-ui-sheet-table-row-header-cell";
		element.style.width = rowHeaderCellWidth + "px";
		element.style.textAlign = "center";
		element.innerHTML = "" + i;
	    }else{
		element.setAttribute("id", "cell-" + i + "-" + (j - 1)); //zero-index the columns
		element.className = "aok-ui-sheet-table-cell";
		element.style.width = cellWidth + "px";
		element.onclick = function(e){ toggleCellMouseClick(e)};
		element.ondblclick = function(e){ editCellElement(e)};
		sheetModel.sheetData[i][j - 1] = new CellData(i, j - 1, element); //zero-index the columns
	    }
	    currentRowElement.appendChild(element);
	}
    }

    // Just store the current cell editing event in local variable
    var sheetEditorCurrentEventListener;

    function operateOnSheetData(sheetData, func){
	sheetData.forEach((rowArray) => {
	    rowArray.forEach((cellData) => {
		func(cellData);
	    });
	});
    }

    function filterSheetData(sheetData, filterFunc){
	var filtered = [];
	operateOnSheetData(sheetData, (cellData) => {
	    if(filterFunc(cellData)){
		filtered.push(cellData);
	    }
	});
	return filtered;
    }

    function getCellFromSheetData(sheetData, row, column){
	return sheetData[row][column];
    }

    function getSelectedCells(sheetData){
	return filterSheetData(sheetData, (cellData) => { return cellData.isSelected(); });
    }

    function selectAllCells(sheetData){
	operateOnSheetData(sheetData, (cellData) => { cellData.select(); });
    }

    function deselectAllCells(sheetData){
	operateOnSheetData(sheetData, (cellData) => { cellData.unselect(); });
    }

    function getCellDataFromElement(cellElement, sheetData){
	var splitId = cellElement.id.split("-");
	var row = splitId[1];
	var col = splitId[2];
	return sheetData[row][col];
    }

    function editCellElement(event){
	var cellData = getCellDataFromElement(event.currentTarget, sheetModel.sheetData);
	if(!cellData.isEditing()){
	    sheetCellEditor.value = cellData.getExpression();
	    sheetEditorCurrentEventListener = function(event){
		if(event.key === "Enter"){
		    cellData.setExpression(sheetCellEditor.value);
		    console.log(cellData.getExpression());
		    sheetCellEditor.removeEventListener("keydown", sheetEditorCurrentEventListener);
		    sheetCellEditor.value = "";
		    sheetCellEditor.blur();
		    cellData.stopEdit();
		    cellData.unselect();
		}
	    };
	    sheetCellEditor.addEventListener("keydown", sheetEditorCurrentEventListener);
	    sheetCellEditor.focus();
	    cellData.unselect();
	    cellData.edit();
	}
    }

    function toggleCellMouseClick(event){
	var cellData = getCellDataFromElement(event.currentTarget, sheetModel.sheetData);
	toggleSelectCell(cellData.column, cellData.row, sheetModel.sheetData);
    }

    function selectCell(column, row, sheetData){
	var cell = getCellFromSheetData(sheetData, row, column);
	if(!cell.isSelected()){
	    cell.select();
	}
    }

    function unSelectCell(column, row, sheetData){
	var cell = getCellFromSheetData(sheetData, row, column);
	if(cell.isSelected()){
	    cell.unselect();
	}
    }

    function toggleSelectCell(column, row, sheetData){
	var cell = getCellFromSheetData(sheetData, row, column);
	if(!cell.isSelected()){
	    cell.select();
	}else{
	    cell.unselect();
	}
    }

    //Bubble UI Code

    var activeBubbleList = [];
    var bubbleCloseTime = 3000; //milliseconds


    function generateBubbleElement(row, col, message){
	//check and remove duplicate location bubble

	var bubbleElementId = "bubble_at_" + row + "_" + col;

	for(var i = 0; i < activeBubbleList.length; i++){
	    var bubbleReg = activeBubbleList[i];
	    if(bubbleReg.elementId === bubbleElementId){
		removeElementById(bubbleReg.elementId);
		activeBubbleList.splice(i,1);
	    }
	}
	var bubbleXPos = ((col - 1) * cellWidth) + rowHeaderCellWidth + (cellWidth / 2);
	var bubbleYPos = (row * (cellHeight + 3)) + columnHeaderCellHeight + (cellHeight / 2);

	var bubbleElement = document.createElement('div');
	bubbleElement.setAttribute("id",bubbleElementId);
	bubbleElement.style.position = "absolute";
	bubbleElement.append(document.createTextNode(message));
	sheetHolder.append(bubbleElement);
	bubbleElement.style.left = bubbleXPos + "px";
	bubbleElement.style.top = bubbleYPos + "px";
	bubbleElement.style.border = "solid 1px black";
	bubbleElement.style.backgroundColor = "white";

	var bubbleRegister = {elementId: bubbleElementId, createTime:Date.now()};
	activeBubbleList.push(bubbleRegister);
	window.requestAnimationFrame(checkRemoveActiveBubbles);
    }

    function checkRemoveActiveBubbles(){
	var now = Date.now();
	for(var i = 0; i < activeBubbleList.length; i++){
	    var bubbleReg = activeBubbleList[i];
	    if(now - bubbleReg.createTime > bubbleCloseTime){
		removeElementById(bubbleReg.elementId);
		activeBubbleList.splice(i,1);
	    }
	}

	if(activeBubbleList.length > 0){
	    window.requestAnimationFrame(checkRemoveActiveBubbles);
	}
    }


    //Export Sheet Controls
    var sheetExportTabOutput = document.createElement("textarea");
    sheetExportTabOutput.setAttribute("id","aok-ui-export-tab-output");
    sheetExportTabOutput.style.height = "350px";
    sheetExportTabOutput.style.width = "100%";
    sheetExportTabOutput.style.backgroundColor = "white";
    sheetExportTabOutput.style.overflow = "scroll";

    var sheetExportButton = document.createElement("button");
    sheetExportButton.innerHTML = "Export Sheet";
    sheetExportButton.addEventListener("click", () => { generateSheetExport(); });

    var sheetImportButton = document.createElement("button");
    sheetImportButton.innerHTML = "Import Sheet";
    sheetImportButton.addEventListener("click", () => { importFromSheetExport(); });

    var exportDelimiter = "|";

    function generateSheetExport(){
	//Iterate over sheet and organize expressions
	var exportString = "";
	for(var row = 0; row < initMaxNumberRows; row++){
	    for(var col = 0; col < initMaxNumberColumns; col++){
		exportString += sheetModel.sheetData[row][col].getExpression();
		if(col !== initMaxNumberColumns - 1){ // do not add a delimiter after last column
		    exportString += exportDelimiter;
		}
	    }
	    exportString += "\n";
	}

	sheetExportTabOutput.value = exportString;
    }

    function importFromSheetExport(){
	var rows = sheetExportTabOutput.value.split("\n");
	if(!rows[rows.length - 1]){ //check for trailing newline character
	    rows.splice(1, rows.length - 1);
	}

	if(rows.length > initMaxNumberRows){
	    fireAOKLogEvent("Max rows exceeded on import, row total: " + rows.length);
	    return;
	}

	for(var row = 0; row < rows.length; row++){
	    var cols = rows[row].split(exportDelimiter);
	    if(cols.length > initMaxNumberColumns){
		fireAOKLogEvent("Max columns exceeded on import, row: " + row + " columns:" + cols.length);
		break;
	    }
	    for(var col = 0; col < cols.length; col++){
		sheetModel.sheetData[row][col].setExpression(cols[col]);
	    }
	}

    }



    // Attach UI Elements
    uiElement.appendChild(tabHolder);
    tabHolder.appendChild(codeTabButton);
    tabHolder.appendChild(sheetTabButton);
    tabHolder.appendChild(sheetExportTabButton);
    tabHolder.appendChild(visTabButton);

    uiElement.appendChild(codeTab);
    codeTab.appendChild(editorElement);
    codeTab.appendChild(loadCodeButton);
    if(hasFileSelector){
	codeTab.appendChild(fileSelector);
    }

    uiElement.appendChild(sheetTab);
    uiElement.appendChild(sheetExportTab);
    uiElement.appendChild(visTab);
    visTab.appendChild(memVisHolder);

    uiElement.appendChild(standardOutput);
    sheetTab.appendChild(sheetCellEditor);
    sheetTab.appendChild(sheetHolder);

    sheetExportTab.appendChild(sheetExportTabOutput);
    sheetExportTab.appendChild(sheetExportButton);
    sheetExportTab.appendChild(sheetImportButton);

    /*
    var testCenters = [];
    for(var row = 0; row < sheetModel.sheetData.length; row++){
	for(var col = 1; col < sheetModel.sheetData[row].length; col++){
	    var testElement = document.createElement("div");
	    testElement.setAttribute("id","test_center_"+row+"_"+col);
	    testElement.style.position = "absolute";
	    testElement.style.height = "10px";
	    testElement.style.width = "10px";
	    testElement.style.backgroundColor = "red";
	    sheetHolder.append(testElement);
	    testElement.style.left = ((col - 1) * cellWidth) + rowHeaderCellWidth + (cellWidth / 2) + "px";
	    testElement.style.top = (row * (cellHeight +3 )) + columnHeaderCellHeight + (cellHeight / 2) + "px";
	}
    }
    */


    //Default Code tab is selected

    codeTab.style.display = "block";

    var editor = CodeMirror(editorElement, {
	lineNumbers: true,
	smartIndent: true,
	value:`
at:cpu@PC(f000)		log "Start address reached!"

// f824 is jump code in Pitfall! -- illustrates state usage in the language.
at:cpu@PC(f824)		{
		log "JUMP!"
                bubble A2 "Message at A2"
                highlight A2
                normal A2
		begin otherjump
	}

<otherjump> at:cpu@PC(f824)	{
		log "JUMP AGAIN!"
		// "" returns to the set of unqualified patterns
		begin ""
	}
`
    });

    // UI State managment

    function fireAOKLogEvent(message){
	aok.aok_event.fire(aok.aok_event.AOK_MESSAGE, {s: message});
	return true;
    }

    aok.aok_event.on(aok.aok_event.AOK_MESSAGE, function(eventData){
	standardOutput.innerHTML += "<span class='aok_message_standard_output'>" + eventData.s + "<br>";
    });

    aok.aok_event.on(aok.aok_event.AOK_LOG, function(eventData){
	console.log("AOK_LOG Called: " + eventData.s);
	standardOutput.innerHTML += "<span class='aok_log_standard_output'>" + eventData.s + "</span><br>";
    });

    aok.aok_event.on(aok.aok_event.AOK_BUBBLE, function(eventData){
	var coord_message = "Bubble at coord: " + "<span class='aok_coord_standard_output'>" + eventData.coord +"</span>" + " with message: " + eventData.s + "<br>";
	var [col, row] = splitAt(1, eventData.coord);
	generateBubbleElement(parseInt(row), columnLetterToNumber(col), eventData.s);
	standardOutput.innerHTML += coord_message;
    });

    aok.aok_event.on(aok.aok_event.AOK_LABEL, function(eventData){
	var [col, row] = splitAt(1, eventData.coord);
	var cell = getCellFromSheetData(sheetModel.sheetData,
					parseInt(row),
					columnLetterToNumber(col));
	cell.setExpression(eventData.s);
    });

    aok.aok_event.on(aok.aok_event.AOK_NORMAL, function(eventData){
	var coord_message = "Normal at coord: " + "<span class='aok_coord_standard_output'>" + eventData.coord +"</span>" + "<br>";
	standardOutput.innerHTML += coord_message;
	var [col, row] = splitAt(1, eventData.coord);
	unSelectCell(columnLetterToNumber(col), parseInt(row), sheetModel.sheetData);
    });

    aok.aok_event.on(aok.aok_event.AOK_HIGHLIGHT, function(eventData){
	var coord_message = "Highlight at coord: " + "<span class ='aok_coord_standard_output'>" + eventData.coord +"</span>" +"<br>";
	standardOutput.innerHTML += coord_message;
	var [col, row] = splitAt(1, eventData.coord);
	console.log(col);
	console.log(row);
	selectCell(columnLetterToNumber(col), parseInt(row), sheetModel.sheetData);
    });

    aok.aok_event.on(aok.aok_event.AOK_FRAME_DISPATCH, function(eventData){
    });

    aok.aok_event.on(aok.aok_event.AOK_INSTR_DISPATCH, function(eventData){
    });

    aok.aok_event.on(aok.aok_event.CONSOLE_FRAME_DISPATCH, function(eventData){
	applyNewTextValuesMap(memVisGridElementArray, aokui_ram.aokSaveState());

	var i;
	for(i = 0; i < sheetModel.frameUpdateList.length; i++){
	    sheetModel.frameUpdateList[i].update();
	}
    });

    aok.aok_event.on(aok.aok_event.CONSOLE_INSTR_DISPATCH, function(eventData){
	var i;
	for(i = 0; i < sheetModel.instrUpdateList.length; i++){
	    sheetModel.instrUpdateList[i].update();
	}

    });


    //Utilties
    const splitAt = (index, string) => [string.slice(0,index), string.slice(index)];
    const removeElementById = function(elementId){
	var element = document.getElementById(elementId);
	element.parentNode.removeChild(element);
    };

};
