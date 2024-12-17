// INFORMATION:
// either create a new account or log in with
// Admin: username: zaz | password: Password
// non-Admin: username: xax | password: Password

/////////////////
///PACKAGES

// bcrypt
const bcrypt = require('bcrypt')


const express=require('express') // load the express package into the express variable
const sqlite3=require('sqlite3') // load the sqlite3 package
const port=8080 // define the port
const app=express() // create the web application/server
const session = require('express-session')        // session in express
const connectSqlite3 = require('connect-sqlite3')

app.use(express.static('public')) // the public directory is static
app.use(express.urlencoded({ extended: true }));

const {engine} = require('express-handlebars')
app.engine('handlebars', engine())


// some helpers are in use for pagination system i developed from chatgpt
app.engine('handlebars', engine({
    helpers: {
        eq (a, b) { return a == b; },
        gt (a, b) { return a > b; },
        lt (a, b) { return a < b; },
        subtract (a, b) { return a - b; },
        add (a, b) { return a + b; },
        range(min, max) { return Array.from({ length: max - min + 1 }, (v, i) => i + min); },
        firstChar(str) {return str ? str.charAt(0) : ''; }
    }
}));
app.set('view engine', 'handlebars')
app.set('views', './views')

// DATABASE
const dbFile='my-project-data.sqlite3.db'
db = new sqlite3.Database(dbFile)

db.serialize( () => {
    db.run(`
        CREATE TABLE IF NOT EXISTS User (
            userID INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL CHECK(length(username) <= 20),
            password TEXT NOT NULL CHECK(length(password) >= 5),
            fName TEXT NOT NULL CHECK(length(fName) <= 20),
            lName TEXT NOT NULL CHECK(length(lName) <= 30),
            birthYear INT NOT NULL CHECK(birthYear >= 1900 AND birthYear <= 2006), 
            startYear INT NOT NULL CHECK(startYear >= 1900 AND startYear <= 2024), 
            role TEXT NOT NULL CHECK(length(role) <= 30),
            jobDesc TEXT NOT NULL CHECK(length(jobDesc) <= 150),
            email TEXT NOT NULL CHECK(length(email) <= 30)
        );
    `);
    // CREATING HOURS TABLE
    db.run(`
        CREATE TABLE IF NOT EXISTS Hours (
            hourID INTEGER PRIMARY KEY AUTOINCREMENT, 
            userID INTEGER NOT NULL, 
            noHours INT NOT NULL CHECK(noHours >= 0 AND noHours <= 24), 
            inputDate TEXT NOT NULL CHECK(length(inputDate) = 10), 
            FOREIGN KEY (userID) REFERENCES User(userID) 
        );
    `);
    // CREATING TOOL TABLE
    db.run(`
        CREATE TABLE IF NOT EXISTS Tool (
	        toolID INTEGER PRIMARY KEY AUTOINCREMENT,
	        tName TEXT NOT NULL CHECK(length(tName) <= 30),
	        version TEXT NOT NULL CHECK(length(version) <= 30),
	        price INTEGER NOT NULL CHECK(price >= 0)	
        );
    `);
    // CREATING USERTOOL TABLE
    db.run(`
        CREATE TABLE IF NOT EXISTS UserTool (
            usertoolID INTEGER PRIMARY KEY AUTOINCREMENT,
            toolID INTEGER NOT NULL, 
            userID INTEGER NOT NULL, 
            FOREIGN KEY (toolID) REFERENCES Tool(toolID),  
            FOREIGN KEY (userID) REFERENCES User(userID)   
        );
    `);
})

///// SESION
const SQLiteStore = connectSqlite3(session)
app.use(session({
    store: new SQLiteStore({db: "session-db.db"}),
    secret: 'sessionSecret',
    resave: true,
    saveUninitialized: true
}))

app.use((req,res,next) => {
    if(req.session.user) {
        res.locals.user = req.session.user;
        res.locals.isAdmin = req.session.isAdmin; 
    } 
    next();
})



// create the (default) route / 
app.get('/', function(req,res) {
    
    const model = {
        isLoggedIn: req.session.isLoggedIn,
        isAdmin: req.session.isAdmin
    }
    console.log("---> HOME MODEL: " + JSON.stringify(model))
    
    res.render('home.handlebars', model)
})
app.get('/about', function (req,res) {
    res.render('about.handlebars')
})
app.get('/contact', function(req,res) {
    res.render('contact.handlebars')
})

/////////////////
// LIST OF USER:S LOGIC
/////////////////

/* Pagination system = chatGPT */
// retrive a list of all personel from databasse and displayed on /personel route
app.get('/personel', function(req, res) {
    if(req.session.isLoggedIn) {
        const limit = 3; 
        const page = parseInt(req.query.page) || 1; 
        const offset = (page - 1) * limit; 

        db.all("SELECT COUNT(*) AS total FROM User", (error, countResult) => {
            if (error) {
                console.log("ERROR FETCHING COUNT: ", error);
                return res.status(500).send("Internal Server Error");
            }

            const totalUsers = countResult[0].total; 
            const totalPages = Math.ceil(totalUsers / limit); 

            db.all("SELECT * FROM User LIMIT ? OFFSET ?", [limit, offset], (error, listOfUsers) => {
                if (error) {
                    console.log("ERROR PERSONEL: ", error);
                } else {
                    const model = {
                        User: listOfUsers,
                        currentPage: page,
                        totalPages: totalPages
                    };
                    console.log("Is admin when entering page: " + req.session.isAdmin);
                    res.render('personel.handlebars', model);
                }
            });
        });
    } else {
        console.log('Accses denied /personel. Redirects to home...')
        res.redirect('/')
    }
});



//////////////
// PROFILE LOGIC
//////////////
// retrive information from all tables regarding user in question, either accessed from /personel route
// or through profile - directly to your own 
app.get('/profile/:userID', function(req, res) {
    if(req.session.isLoggedIn) {
        const userID = req.params.userID; 
        //console.log("USERID : " + userID); 
        db.get("SELECT * FROM User WHERE userID = ?", [userID], (error, user) => {
            if (error) {
                console.log("ERROR fetching user: ", error);
                return res.status(500).send('Internal Server Error');
            }
            if (!user) {
                return res.status(404).send('User not found');
            }
            db.all("SELECT t.tName, t.version FROM Tool t INNER JOIN UserTool ut ON t.toolID = ut.toolID WHERE ut.userID = ?", [userID], (error, tools) => {
                if (error) {
                    console.log("ERROR fetching tools: ", error);
                    return res.status(500).send('Internal Server Error');
                }
                db.all(`SELECT h.noHours, h.inputDate FROM Hours h WHERE h.userID = ? 
                    ORDER BY h.inputDate DESC LIMIT 3`, [userID], (error, hours) => {
                    if (error) {
                        console.log("ERROR fetching hours: ", error);
                        return res.status(500).send('Internal Server Error');
                    }
                    db.get(`SELECT SUM(noHours) AS totalHours FROM Hours WHERE userID = ? AND 
                      inputDate >= date('now', '-1 month')`, [userID], (error,stats) => {
                        if(error) {
                            console.log('Error fecthing hours worked last month')
                        }
                        const model = {
                            User: user, 
                            Tools: tools || [], 
                            Hours: hours || [], 
                            TotalHours: stats.totalHours
                        };
                        res.render('profile.handlebars', model);
                    })
                });
            });
        });
    } else {
        //console.log('acces denied to /profile/:userID. Redirects to home')
        res.redirect('/')
    }
});
// delete user, accessed from personel view, if you are user that is to be deleted, session destroyed.
// also delete all other rows regarding the userID like inputed hours or tools
app.get('/profile/delete/:userID', function(req, res) {
    if(req.session.isAdmin) {
        const userID = req.params.userID; 
        const loggedInUserID = req.session.user.userID; 
        console.log("User route parameter userID: " + userID);
        console.log("Logged-in user: " + loggedInUserID); 
        db.serialize(() => {
            db.run("DELETE FROM User WHERE userID = ?", [userID], function(error) {
                if (error) {
                    console.log("ERROR deleting user: ", error);
                    return res.status(500).send('Internal Server Error'); 
                }
                db.run("DELETE FROM Hours WHERE userID = ?", [userID], function(error) {
                    if (error) {
                        console.log("ERROR deleting hours: ", error);
                        return res.status(500).send('Internal Server Error'); 
                    }
                    db.run("DELETE FROM UserTool WHERE userID = ?", [userID], function(error) {
                        if (error) {
                            console.log("ERROR deleting user tools: ", error);
                            return res.status(500).send('Internal Server Error'); 
                        } 
                        console.log('The user ' + userID + ' has been deleted ...');
                        if (userID == loggedInUserID) {
                            console.log('userID = loggedInUserID')
                            req.session.destroy(err => {
                                if (err) {
                                    console.log("Error destroying session: ", err);
                                    return res.status(500).send('Internal Server Error'); 
                                }
                                res.redirect('/login'); 
                            });
                        } else {
                            console.log('userID ' + userID + ' != loggedInUserID ' + loggedInUserID)
                            res.redirect('/personel'); 
                        }
                    });
                });
            });
        });
    } else {
        console.log('access denied, cannot delete user - not admin')
        res.redirect('/personel')
    }
});
// modify user from register template - just like in the lab
app.get('/profile/modify/:userID', function(req,res) {
    if(req.session.isAdmin) {
        const id = req.params.userID;
        db.get("SELECT * FROM User WHERE userID = ?", [id], (error, theUser) => {
            if(error) {
                console.log("ERROR: ", error)
                res.redirect('/personel')
            } else {
                model = {user : theUser}
                res.render('register.handlebars', model)
            }
        })
    } else {
        res.redirect('/personel')
    }
})
// if a new password is printed. The password will be encrypted and set to user
app.post('/profile/modify/:userID', function (req, res) {
    const id = req.params.userID;
    const { username, password, fName, lName, birthYear, startYear, role, jobDesc, email } = req.body;
    db.get(`SELECT password FROM User WHERE userID = ?`, [id], (error, user) => {
        if (error) {
            console.log("ERROR fetching user: ", error);
            return res.redirect('/personel'); 
        }
        let newPassword = user.password;
        if (password) {
            newPassword = bcrypt.hashSync(password, 14);
        }
        db.run(`UPDATE User SET
            username=?, password=?, fName=?, lName=?, birthYear=?, startYear=?, role=?, jobDesc=?, email=? 
            WHERE userID =?`, [username, newPassword, fName, lName, birthYear, startYear, role, jobDesc, email, id], (error) => {
            if (error) {
                console.log("ERROR-modify: ", error);
                return res.redirect('/personel'); 
            } else {
                console.log("modify worked");
                return res.redirect('/personel'); 
            }
        });
    });
});
// go to /profile:userID where userID is logged in user
app.get('/profile', function(req, res) {
    if (req.session.isLoggedIn) {
        const userID = req.session.user.userID;
        console.log('Logged in user who enters profile: ' + userID);
        res.redirect(`/profile/${userID}`); 
    } else {
        res.redirect('/');
    }
});



/////////////////
// TOOLS LOGIC
/////////////////

// list of tools
app.get('/tools', function(req, res) {
    if(req.session.isAdmin) {
        db.all("SELECT * FROM Tool ORDER BY price DESC", (error, listOfTools) => {
            if (error) {
                console.log("ERROR tools: ", error);
                return res.status(500).send('Internal Server Error');
            } else {
                const model = { Tool: listOfTools }; 
                //console.log("Enters page: tools");
                res.render('tools.handlebars', model); 
            }
        });
    } else {
        res.redirect('/')
    }
});
// create a tool
app.get('/tools/createTool', function(req,res) {
    if(req.session.isAdmin) {
        res.render('createTool.handlebars')
    } else {
        res.redirect('/')
    }
})
app.post('/tools/createTool', function(req,res) {
    const {tName, version, price} = req.body
    db.run(`INSERT INTO Tool (tName, version, price) VALUES (?,?,?)`, [tName, version, price], (error) => {
        if(error) {
            console.log("ERROR while insert into tools: ", error)
        } else {
            console.log("Line added into Tool table")
            res.redirect('/tools')
        }
    })
})
// gather information from, who owns the tool + their name + ...
app.get('/toolsOwner', function(req, res) {
    if (req.session.isAdmin) { /* I set up the query beforehand to make code more readable */
        const query = `
            SELECT UserTool.usertoolID, User.userID, User.fName, User.lName, Tool.tName, Tool.version, Tool.price
            FROM UserTool
            INNER JOIN User ON User.userID = UserTool.userID
            INNER JOIN Tool ON Tool.toolID = UserTool.toolID
            ORDER BY User.fName
        `;
        db.all(query, (error, listOfUserTool) => {
            if (error) {
                //console.log('Problem with toolsOwner view: ', error);
                return res.status(500).send('Internal Server Error');
            } else {
                const model = { listOfUserTool };
                res.render('toolsOwner.handlebars', model);
            }
        });
    } else {
        res.redirect('/');
    }
});
// form to get a new owner
app.get('/toolsOwner/newOwner', function(req, res) {
    if(req.session.isAdmin) {
        console.log("Enters page .../newOwner");
        db.all("SELECT toolID, tName, version FROM Tool", (error, listOfTools) => {
            db.all("SELECT userID, lName FROM User",  (error, listOfUsers) => {
                if(error) {
                    console.log('ERROR: ', error);
                    return res.status(500).send('Internal server error');
                }
                const model = {
                    tools:listOfTools,
                    user:listOfUsers
                };
                res.render('newOwner.handlebars',model);
            })
        });
    } else {
        res.redirect('/');
    }
});
// simple insert statement
app.post('/toolsOwner/createOwner', function(req, res) {
    const { userID, toolID } = req.body;
    db.run("INSERT INTO UserTool (userID, toolID) VALUES (?, ?)", [userID, toolID], (error) => {
        if (error) {
            console.log("ERROR creating new owner: ", error);
            return res.status(500).send('Internal Server Error');
        }
        console.log(`New owner assigned: userID=${userID}, toolID=${toolID}`);
        res.redirect('/toolsOwner'); 
    });
});
// delete a relationship between user and tool
app.get('/toolsOwner/delete/:usertoolID', function(req, res) {
    if(req.session.isAdmin) {
        const usertoolID = req.params.usertoolID;
        console.log(`Attempting to delete userTool with ID: ${usertoolID}`);
        db.run(`DELETE FROM UserTool WHERE usertoolID = ?`, [usertoolID], function(error) {
            if (error) {
                console.log("Problems when deleting user-tool relationship: ", error);
                return res.status(500).send('Internal Server Error');
            } else {
                console.log('Entry successfully deleted from UserTool table');
                return res.redirect('/toolsOwner');
            }
        });
    } else {
        res.redirect('/')
    }
});


/////////////
// INPUT TIME AND HOURS LOGIC 
/////////////
// view of latest inputed hours by all users
app.get('/timeView', function(req,res) {
    if(req.session.isAdmin) {
        db.all("SELECT * FROM Hours ORDER BY inputDate DESC", (error, listOfHours) => { 
            if(error) {
                console.log("ERROR timeView: ", error)
            } else {
                model = { Hours: listOfHours }
                //console.log('Enters page: timeView')
                res.render('timeView.handlebars', model)
            }   
        })
    } else {
        res.redirect('/')
    }
})
// form to enter hours (only your account can do to yourself)
app.get('/registerTime', function(req,res) {
    if(req.session.isLoggedIn) {
        res.render('registerTime.handlebars')
    } else {
        res.redirect('/')
    }
})
// Simple insert statement into hours
app.post('/registerTime', function(req,res) {
    const {noHours, inputDate} = req.body;
    const userID = req.session.user.userID;
    //console.log('post : registerTime ' + userID);
    db.run("INSERT INTO Hours (userID, noHours, inputDate) VALUES (?,?,?)", [userID, noHours, inputDate], (error) => {
        if(error) {
            console.log("ERROR post registerTime : ", error)
            model={error};
        } else {
            console.log("line added into Hours table!")
            res.redirect('/')
        }
    })
})


//////
// LOGIN / REGISTER LOGIC
//////
app.get('/register', (req,res)=> {
    res.render('register.handlebars');
})
// as username is connected to password, check if username allready taken. Simple insert statement
app.post('/register', async (req, res) => {
    const {username, password, fName, lName, birthYear, startYear, role, jobDesc, email} = req.body;
    db.get('SELECT * FROM User WHERE username = ?', [username], async (err, user) => {
        if (err) {
            res.status(500).send('Server error');
        } else if (user) {
            const model = { err: "Username already taken", message: "" };
            res.status(400).render('register.handlebars', model);
        } else {
            const hash = await bcrypt.hash(password, 14);
            db.run(`INSERT INTO User (username, password, fName, lName, birthYear, startYear, role, jobDesc, email)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [username, hash, fName, lName, birthYear, startYear, role, jobDesc, email], 
                (err) => {
                    if (err) {
                        res.status(500).send('Server error');
                    } else {
                        res.redirect('/login');
                    }
                }
            );
        }
    });
});
app.get('/login', (req,res) => {
    res.render('login');
}) 
// login user if password matches username
app.post('/login', async (req,res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM User WHERE username=?', [username], async (err, user) => {
        if(err) {
            model= {err: "Server error", message: ""}
            console.log(model)
            return res.status(500).render('login.handlebars', model)
        } else if(!user) {
            model= {err: "User not found", message: ""}
            console.log(model)
            return res.status(401).render('login.handlebars', model)
        } else {
            const result = await bcrypt.compare(password, user.password);

            if(result) {
                req.session.user = user;
                req.session.isLoggedIn = true;                
                if (user.role == 'admin' || user.role == 'Admin') {
                    req.session.isAdmin = true;
                } else {
                    req.session.isAdmin = false; 
                }
                return res.redirect('/')
            } else {
                const model = {err: "Wrong password", message:""}
                return res.status(401).render('login.handlebars', model)
            }
        }
    })
})
// logout user, destroy session
app.get('/logout', (req,res) => {
    req.session.destroy( (err) => {
        if(err) {
            console.log("Error while destroying the session: ", err)
        } else {
            console.log("Logged out!")
            res.redirect('/')
        }
    })
})

// ERROR HANDLING
app.use(function(req,res) {
    res.status(404).redirect('/');
})


// listen to the port
app.listen(port, function () {
    console.log('Server is listening on port '+port+'...')
})