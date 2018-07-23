// following structure of existing Javatari JS code

jt.AOK = function(emu) {
    "use strict";
    var self;

    function assert(b) {
        if(!b) {
            console.error("Assertion failed",b);
            throw "Assertion failed";
        }
    }

    var memoryAnalysisContext = {
        tokens: [
            {
                type:"at",
                match: /^at:([a-zA-Z_0-9]+)(@[0-9A-z_]+)?\((!?)([^)]+)\)/,
                // Examples:
                // at:mem@0x20(AF029F)
                // at:cpu@A(u128)
                // at:mem(s-12 DED8 m0--10--- [m1000---- m0---100- FF u35])
                // at:mem(.* (DED8) .*) (not allowed yet)
                // at:mem+0x80(00), at:mem+80(01), at:mem+80(02)
                // (at:mem+0x80(00) & at:mem+FF(u10)), ..., at:mem+80(FF))
                // TODO: allow for anchoring exactly at an offset.
                value: function(matchResult) {
                    var memBlock = matchResult[1];
                    var offset = null;
                    if(matchResult[2]) {
                        var offsetStr = matchResult[2].substr(1);
                        var isNumeric = false;
                        var actualOffset = offsetStr;
                        if(offsetStr.match(/^0x([0-9a-fA-F_]+)$/)) {
                            isNumeric = true;
                            actualOffset = parseInt(offsetStr.substr(2).replace("_",""), 16);
                        } else if(offsetStr.match(/^[0-9]+$/)) {
                            isNumeric = true;
                            actualOffset = parseInt(offsetStr, 10);
                        }
                        offset = {
                            numeric: isNumeric,
                            actualOffset: actualOffset
                        };
                    }
                    var isAnchored = matchResult[3] == "!";
                    var pattern = [];
                    var patternStr = matchResult[4];
                    var inSet = false;
                    while(patternStr.length) {
                        //patterns can be hex digits, unums, masks, or [] unions of those
                        var r = null;
                        if((r = patternStr.match(/^[0-9A-Fa-f _]{2}/))) {
                            pattern.push(hexToCode(r[0].replace("_","").replace(" ","")));
                            patternStr = patternStr.substr(r[0].length);
                        } else if((r = patternStr.match(/^u([0-9]+)/))) {
                            assert(parseInt(r[1],10) < 256);
                            pattern.push(decToCode(r[1]));
                            patternStr = patternStr.substr(r[0].length);
                        } else if((r = patternStr.match(/^m([01\-]{8})/))) {
                            var sets = charCodesMatching(r[1]);
                            if(inSet) {
                                pattern[pattern.length-1].push(sets);
                            } else {
                                pattern.push(sets);
                            }
                            patternStr = patternStr.substr(r[0].length);
                        } else if(patternStr[0] == "[") {
                            inSet = true;
                            pattern.push([]);
                            patternStr = patternStr.substr(1);
                        } else if(patternStr[0] == "]") {
                            assert(inSet == true);
                            inSet = false;
                            patternStr = patternStr.substr(1);
                        } else if(patternStr.match(/[\s_]/)) {
                            patternStr = patternStr.substr(1);
                        } else {
                            assert(false);
                        }
                    }
                    return {
                        block:memBlock,
                        offset:offset,
                        pattern:pattern,
                        anchored:isAnchored
                    };
                },
                startParse: Playspecs.parseValue
            }
        ],
        trace: {
            start: function (traceData) {
                return {index: -1, consumed:true};
            },
            isReady: function(trace) {
                return trace.index > -1;
            },
            currentState: function (trace) {
                return self.currentState;
            },
            advanceState: function (trace) {
                if(!trace.consumed) {
                    trace.index += 1;
                    trace.consumed = true;
                }
            },
            copyState: function(trace) {
                if(!self.copyIsCurrent) {
                    emu.aokSaveState(self.currentCopy);
                    self.copyIsCurrent = true;
                }
                return self.currentCopy;
            },
            isStreaming: function(trace) {
                //TODO: return false if the game is off?
                return true;
            },
            isAtEnd: function (trace) {
                return trace.consumed;
            }
        },
        checks: {
            "at": function(trace, state, idx, atNode) {
                // console.log(state);
                var memblk = state[atNode.value.block];
                var off = 0;
                if(atNode.value.offset.isNumeric) {
                    off = atNode.value.offset.actualOffset;
                } else {
                    memblk = memblk[atNode.value.offset.actualOffset];
                }
                var pat = atNode.pattern;
                var end = memblk.length;
                if(atNode.isAnchored) {
                    end = off+1;
                }
                for(var i = off; i < end; i++) {
                    if(bmatches(memblk[i],pat[0])) {
                        var match = true;
                        for(var j = i+1; j < i + pat.length; j++) {
                            if(!bmatches(memblk[j],pat[j-i])) {
                                match = false;
                                break;
                            }
                        }
                        if(match) {
                            return {node:atNode, offset:i};
                        }
                    }
                }
                //TODO: don't use constant strings, use regex on bytes
                return null;
            }
        }
    };

    function emptyState() {
        return {'tia':null, 'ram':null, 'cpu':null};
    }

    function init(self) {
        self.checked_specs = [];
        self.currentState = emptyState();
        self.currentCopy = emptyState();
        self.copyIsCurrent = false;
        return self;
    }

    function bmatches(a, pat) {
        //TODO: replace with a compiled regex later
        if(pat % 1 === 0) {
            return a == pat || (a == true && pat == 1) || (a == false && pat == 0);
        } else if(Array.isArray(pat)) {
            for(var i = 0; i < pat.length; i++) {
                if(bmatches(a, pat[i])) {
                    return true;
                }
            }
            return false;
        } else {
            return (a & pat.inBits) == pat.inBits &&
                (a & pat.outBits) == 0;
        }
    }
    function hexToCode(str) {
        assert(str.length == 2);
        return parseInt(str,16);
    }
    function decToCode(str) {
        var num = parseInt(str,10);
        return num;
    }
    function charCodesMatching(bitstr) {
        // "\xFF"
        assert(bitstr.length == 8);
        var i;
        var dontcareMask = 0;
        var inMask = 0;
        var outMask = 0;
        for(i = 0; i < bitstr.length; i++) {
            if(bitstr[i] == "-") {
                dontcareMask |= 1 << (7-i);
            } else if(bitstr[i] == "1") {
                inMask |= 1 << (7-i);
            } else if(bitstr[i] == "0") {
                outMask |= 1 << (7-i);
            } else {
                assert(false);
            }
        }
        return {inBits:inMask, outBits:outMask};
    }

    // common matching code for instrs and frames
    this.domatch = function(state) {
        // walk through entirety of spalist to update playspec state
        // even if the matches aren't used (XXX needed?)
        var ps;
        self.currentState = state;
        for (var i = 0; i < lstate.spalist.length; i++) {
            ps = lstate.spalist[i][1];
            if (ps.state.trace.index == -1) {
                ps.state.trace.index = 0;
                ps.state.trace.consumed = false;
            }
            ps = ( lstate.spalist[i][1] = ps.next() );
            ps.state.trace.consumed = true;
        }
        // process any found matches, obeying language semantics re: continue
        // XXX continue nyi
        for (i = 0; i < lstate.spalist.length; i++) {
            ps = lstate.spalist[i][1];
            if (ps.match) {
                console.log("match on spalist index " + i);
            }
        }
        self.copyIsCurrent = false;
    };

    // hook called at instruction dispatch point
    this.instructionDispatch = function(state) {
        if (lstate.frame_on == false) {
            this.domatch(state);
        }
    };

    // hook called at top of frame
    this.frame = function(state) {
        if (lstate.frame_on == true) {
            this.domatch(state);
        }
    };

    // initialize playspec matching state
    this.initMatching = function() {
        self.currentState = emptyState();
        self.copyIsCurrent = false;
        self.copyState = emptyState();
    };

    // Call this to make this instance of AOK start matching the given traces.
    // TODO AOK: You probably want to call it before the emulator starts!
    this.__UNUSED__startMatching = function(playspec_strings) {
        //atomic formula syntax for "scan through memory region for pattern":
        //at:MEM@OFF(ANCHOR PAT+)
        //Where:
        //  MEM: tia | cpu | mem
        //  OFF (optional): register_name | 0xOffset [beginning of search]
        //  ANCHOR (optional): !, force match to be exactly at MEM+OFF.
        //  PAT: HEXPAIR | UNSIGNED | MASK | SET
        //    HEXPAIR: two hex digits
        //    UNSIGNED: unsigned decimal value prefixed with 'u'
        //    MASK: 'm' followed by 8 characters from the set {0,1,-}.  0 means "the byte being matched must be 0 here", 1 means it must be 1, and - means "don't care".  ex: m0010---- to check some high bits.
        //    SET: [ PAT+ ] to check the disjunction of several patterns
        //    Whitespace and underscores are ignored.
        //the check results will tell you where the pattern was matched, which is better than nothing!
        //for the full playspecs syntax please see the AIIDE paper or the playspecs doc/ folder.
        self.currentState = emptyState();
        self.copyIsCurrent = false;
        self.copyState = emptyState();
        self.matches = [];
        self.checks = [];
        for(var i = 0; i < playspec_strings.length; i++) {
            self.checks.push((new Playspecs.Playspec(playspec_strings[i], memoryAnalysisContext)).match(null, "explicit"));
            self.matches.push([]);
        }
    };

    // Implement this however you like to handle matches.
    // Probably best to not use a "matches" list like this,
    // just flag them however you want.  This is just for illustration.
    this.__UNUSED__processMatch = function(idx, checkResult) {
        this.matches[idx].push(checkResult.match);
    };


    // language state
    var lstate = {
        throttle: null, // emu speed XXX to do
        frame_on: null, // frame or instr matching
        curstate: null, // current matching state, '' is normal
        start:    null, // list of <START> actions, if any
        referenced: null, // state names referenced
        seenused: null, // state names seen (statically) used in spec
        continue: null, // tmp flag for communicating back to processing
        spalist:  null // state-pattern-action (ordered) list
    };

    //function resetlangstate() {
    this.resetlangstate = function() {
        lstate.throttle = 100;
        lstate.frame_on = false;
        lstate.curstate = '';
        lstate.start = null;
        lstate.referenced = {};
        lstate.seenused = {};
        lstate.continue = false;
        lstate.spalist = [];
        // and clear playspec state
        this.initMatching();
    }

    // command implementations - add new ones to ctab too
    function c_frame() {
        lstate.frame_on = true;
    }
    function c_instr() {
        lstate.frame_on = false;
    }
    function c_throttle(n) {
        if (n < 1) {      // quietly clamp value
            n = 1;
        } else if (n > 100) {
            n = 100;
        }
        lstate.throttle = n;
    }
    function c_begin(name) {
        lstate.curstate = name;
    }
    function c_log(s) {
        console.log(s);
    }
    function c_continue(s) {
        lstate.continue = true;
    }
    function c_eval(s) {
        eval(s);
    }

    // XXX nyi
    function c_highlight(coord) {
        console.log("NYI: highlight " + coord);
    }
    function c_normal(coord) {
        console.log("NYI: normal " + coord);
    }
    function c_message(s) {
        console.log("NYI: message " + s);
    }
    function c_bubble(coord, s) {
        console.log("NYI: bubble " + coord + " " + s);
    }

    // run a list of commands
    function runcmds(L) {
        var i, s, f, args;
        for (i = 0; i < L.length; i++) {
            f = L[i][0];
            args = L[i][1];
            try {
                f.apply(null, args);
            } catch (s) {
                console.log(s);
                return;
            }
        }
    }

    this.newfile = function(s) {
        var error, last = null, lineno = 1;

        // Command table, maps command name into arg-type/function.
        // Argument type encodings are
        //  n positive integer
        //  c spreadsheet coordinate
        //  w word (or quoted string)
        //  s state name
        //
        var ctab = {
            'throttle': [ 'n',    c_throttle ],
            'frame':  [ '',   c_frame ],
            'instr':  [ '',   c_instr ],
            'begin':  [ 's',    c_begin ],
            'log':    [ 'w',    c_log ],
            'highlight':  [ 'c',    c_highlight ],
            'normal': [ 'c',    c_normal ],
            'message':  [ 'w',    c_message ],
            'bubble': [ 'cw',   c_bubble ],
            'continue': [ '',   c_continue ],
            'eval':   [ 'w',    c_eval ] // for Eric :-)
        }

        // Scanner returns lexemes whose token type can be distinguished
        // based on the first character:
        //  a at:...
        //  , ,
        //  & &
        //  < <state>
        //  { {
        //  } }
        //  " "word"
        //  \n  \n
        //  $ EOF
        //  ? wtf?
        //
        var peek = function() {
            if (last != null) {
                return last;
            }
            return last = lex();
        }

        var lex = function() {
            var rv, m, re;

            if (last != null) {
                rv = last;
                last = null;
                return rv;
            }

            while (true) {
                // skip whitespace except \n
                re = /^[ \t\r]+/g;
                if ((m = re.exec(s)) !== null) {
                    s = s.slice(re.lastIndex);
                    continue;
                }
                // skip comments
                re = /^\/\/[^\n]*/g;
                if ((m = re.exec(s)) !== null) {
                    s = s.slice(re.lastIndex);
                    continue;
                }
                // EOF
                if (s.length == 0) {
                    return '$';
                }
                // pick off singletons
                switch (rv = s[0]) {
                case '\n':
                    lineno += 1;
                    // falls through
                case '{':
                case '}':
                case ',':
                case '&':
                    s = s.slice(1);
                    return rv;
                }
                // states
                re = /^<\w+>/g;
                if ((m = re.exec(s)) !== null) {
                    s = s.slice(re.lastIndex);
                    return m[0];
                }
                // (single) at:... expressions
                re = /^at:\w+(@\w+)?\((!?)([^)]+)\)/g;
                if ((m = re.exec(s)) !== null) {
                    s = s.slice(re.lastIndex);
                    return m[0];
                }
                // unquoted word
                re = /^\w+/g;
                if ((m = re.exec(s)) !== null) {
                    s = s.slice(re.lastIndex);
                    return '"' + m[0] + '"';
                }
                // quoted text
                re = /^"[^\n"]*"/g;
                if ((m = re.exec(s)) !== null) {
                    s = s.slice(re.lastIndex);
                    return m[0];
                }
                // lexical error - advance one char
                s = s.slice(1);
                return '?';
            }
        }

        // Ye olde recursive descent parser, for the grammar
        //
        // start ::= { globalstmt } EOF
        // globalstmt ::= '\n'
        // globalstmt ::= STATE action
        // globalstmt ::= [ STATE ] atexpr action
        // action ::= stmt
        // action ::= '{' { stmt } '}'
        // stmt ::= { WORD } '\n'
        // atexpr ::= AT { ( ',' | '&' ) AT }
        //
        var checkargs = function(cmd, args) {
            var i, re, cargs = ctab[cmd][0];
            if (args.length < ctab[cmd][0].length) {
                throw "not enough arguments for " + cmd;
            }
            if (args.length > ctab[cmd][0].length) {
                throw "too many arguments for " + cmd;
            }
            for (i = 0; i < cargs.length; i++) {
                switch (cargs[i]) {
                case 'n':
                    re = /^\d+$/;
                    if (re.test(args[i]) == false) {
                        throw "bad number for " + cmd;
                    }
                    break;
                case 'c':
                    re = /^[A-Z]+\d+$/;
                    if (re.test(args[i]) == false) {
                        throw "bad coordinate for " + cmd;
                    }
                    break;
                case 's':
                    // * not + to allow return to "" state
                    re = /^\w*$/;
                    if (re.test(args[i]) == false) {
                        throw "bad state name for " + cmd;
                    }
                    if (args[i] == 'START') {
                        throw "can't use START for " + cmd;
                    }
                    lstate.referenced[args[i]] = true;
                    break;
                case 'w':
                    // whatevs
                    break;
                default:
                    console.log("bad ctab arg spec (INTERNAL)");
                    break;
                }
            }
        }

        var stmt = function() {
            var t, words = [];
            while ((t = lex())[0] == '"')
                words.push(t.slice(1, -1));
            if (t != '\n') {
                throw "statement should be words then newline";
            }

            // now check it
            if (words.length == 0) {
                return null;
            }
            var cmd;
            for (cmd in ctab) {
                if (words[0] == cmd) {
                    var args = words.slice(1);
                    checkargs(cmd, args);
                    return [ ctab[cmd][1], args ];
                }
            }
            console.log("Warning: unknown command "+ words[0] +" skipped");
            return null;
        }

        var action = function() {
            var S, L = [];
            if (peek() != '{') {
                S = stmt();
                return (S === null) ? [] : [ S ];
            } else {
                lex();        // consume {
                while (peek() != '}') {
                    S = stmt();
                    if (S !== null) {
                        L.push(S);
                    }
                }
                lex();        // consume }
                return L;
            }
        }

        var atexpr = function() {
            var t, expr = '';
            if ((t = lex())[0] != 'a') {
                throw 'expected "at" expression';
            }
            expr = t;
            while (peek() == ',' || peek() == '&') {
                expr += lex();
                if ((t = lex())[0] != 'a') {
                    throw 'expected more "at" expressions';
                }
                expr += t;
            }
            return expr;
        }

        var makePS = function(expr) {
            // Utility function wrapping playspec creation.
            //
            // XXX An exception object's thrown by PS for malformed
            //  expressions, and long-term should get caught,
            //  re-formatted as a string, and thrown anew, but the
            //  info's too useful for debugging right now.
            //
            var p = new Playspecs.Playspec(expr, memoryAnalysisContext);
            return p.match(null, "explicit");
        }

        var globalstmt = function() {
            var s = '', t = peek();
            switch (t[0]) {
            case '\n':
                lex();
                break;
            case '<':
                s = t.slice(1, -1);
                lstate.seenused[s] = true;

                lex();
                if (peek()[0] != 'a') {
                    if (s != 'START') {
                        throw "can only omit at-expr for START";
                    }
                    if (lstate.start !== null) {
                        throw "can only specify START once";
                    }
                    lstate.start = action();
                    break;
                }
                // falls through
            case 'a':
                var expr = atexpr();
                var actions = action();
                var ps = makePS(expr);
                lstate.spalist.push([ s, ps, actions ])
                break;
            default:
                throw "expected pattern";
            }
        }

        var start = function() {
            while (peek() != '$') {
                globalstmt();
            }
            if (lex() != '$') {
                throw "expected EOF";
            }
        }

        // parse through spec file
        this.resetlangstate();
        try {
            start();
        } catch (error) {
            console.log("Error: " + error + " at or near line " + lineno);
            this.resetlangstate();
            return;
        }

        // typo checks on state names
        var name;
        for (name in lstate.referenced) {
            if (name == '') {
                continue;
            }
            if (!(name in lstate.seenused)) {
                console.log("Warning: undefined state " +name+ " used");
            }
        }
        for (name in lstate.seenused) {
            if (name == 'START') {
                continue;
            }
            if (!(name in lstate.referenced)) {
                console.log("Warning: no begin uses state " + name);
            }
        }

        // run initial commands, if any
        if (lstate.start !== null) {
            runcmds(lstate.start);
        }
    };

    return (self = init(this));
};
