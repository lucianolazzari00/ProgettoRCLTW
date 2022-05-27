const express = require("express")
const session = require("express-session")
const axios = require("axios")
const mongoose = require("mongoose")
const MongoDBSession = require("connect-mongodb-session")(session)
const app = express()

//---------login/logout/registration----------//

const userModel = require('./models/User.js')
urldb = 'mongodb://mongo:27017/sessions'

//connect DB
mongoose
    .connect(urldb, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        })
    .then((res) => {
        console.log("mongoDB connected successfully")
    });

//auto store sessions
const store = new MongoDBSession({
    uri: urldb,
    collection: "mySessions",
});

app.use(express.urlencoded({extended:false}))
app.use(express.json())


//session configuration
app.use(
    session({
        secret: "key that will sign cookie",
        resave: false,
        saveUninitialized: false,
        store: store,
    })
)

//check if user is auth
const isAuth = (req,res,next) => {
    if(req.session.isAuth){
        next()
    } 
    else {
        res.redirect("static/index.html")
    } 
}

app.post("/sign-up", async(req,res)=>{
    email = req.body.email
    psw = req.body.psw

    let user = await userModel.findOne({email})

    if(user){
        return res.status(403).send()
    } 
    
    user = new userModel({
        email,
        password : psw, //need to be hashed
    });

    await user.save()
    
    res.status(201).send()
})

app.post("/sign-in", async (req,res)=>{
    email = req.body.email
    psw = req.body.psw
    console.log(req.body)

    let user = await userModel.findOne({email})

    if(!user){
        return res.status(400).send()
    }

    const pswIsCorrect = user.password == psw;

    if(!pswIsCorrect){
        return res.status(401).send()
    }

    req.session.isAuth = true;


    //binda email e sessionid
    axios
        .post(couch_url, {
            user: email,
            sid: req.sessionID
        })
        .then(response => {
            console.log(`statusCode: ${response.status}`);
            //console.log(response);

        })
        .catch(error => {
            console.error(error);
        });

    res.status(201).send()
    
})

couch_url =  "http://admin:admin@couchdb:5984/users_session"

app.get("/logout",(req,res)=>{
    ssid = req.sessionID.toString()
    req.session.destroy((err)=>{
        if(err) {
            throw err;
        }
        //remove session from couchdb
        axios
            .post(couch_url + "/_find",{
                selector:{
                    sid: ssid
                }
            })
            .then(response => {
                console.log(`statusCode: ${response.status}`);
                console.log(response.data);
                doc_id = response.data.docs[0]._id
                rev = response.data.docs[0]._rev
                delete_url = couch_url + "/" + doc_id + "/?rev=" + rev
                //-----
                axios
                    .delete(delete_url)
                    .then(res2 => {
                        console.log(`statusCode: ${response.status}`);
                        console.log(response);
                    })
                    .catch(error => {
                        console.error(error);
                    });
                //------
            })
            .catch(error => {
                console.error(error);
                return res.send(error)
            });
        res.redirect("/static/index.html");
    });
})

//-----------gestione dati utente-----------//

couch_url_data =  "http://admin:admin@couchdb:5984/users_data"

app.post("/user/datas",(req,res)=>{
    console.log("BODY DELLA REQUEST:---------------------------------")
    console.log(req.body)
    if(req.session.isAuth){
        ssid = req.sessionID.toString()
        //-----
        axios
            .post(couch_url + "/_find",{
                selector:{
                    sid: ssid
                }
            })
            .then(response => {
                console.log(`statusCode: ${response.status}`);
                console.log("RESPONSE X CATCHARE LA MAIL:---------------------------------")
                console.log(response.data);
                user_mail = response.data.docs[0].user
                //-----
                axios
                    .post(couch_url_data,{
                        user: user_mail, 
                        nameasset: req.body.nameasset,
                        quantity: req.body.quantity,
                        price: req.body.price,
                        date: req.body.date, 
                    })
                    .then(response2 => {
                        console.log("RESPONSE 2-----------------------------")
                        console.log(`statusCode: ${response2.status}`);
                        console.log(response2.body);
                    })
                    .catch(error2 => {
                        console.log("errore 2:---------------------------------")
                        console.error(error2);
                        return res.send(error2)
                    });
                //------
            })
            .catch(error => {
                console.error(error);
                return res.send(error)
            });
        //-----
       
        res.status(201).send("ok")

    }
    else{
        //send error
        res.status(401).send()
    }
})

app.get("/user/datas", (req,res)=>{
    if(req.session.isAuth){
        ssid = req.sessionID.toString()
        //---
        axios
            .post(couch_url + "/_find",{
                selector:{
                    sid: ssid
                }
            })
            .then(response => {
                console.log(`statusCode: ${response.status}`);
                console.log("RESPONSE DELLA GET 1--------------------------------")
                console.log(response.data);
                len_doc = response.data.docs.length
                if(len_doc) user_mail = response.data.docs[0].user;
                else return res.status(401).send()
                console.log("USER MAIL: " + user_mail)
                //-----
                axios
                    .post(couch_url_data + "/_find",{
                        selector:{
                            user: user_mail
                        }
                    })
                    .then(response => {
                        console.log(`statusCode: ${response.status}`);
                        console.log(response.data);
                        res.send(JSON.stringify(response.data.docs))
                    })
                    .catch(error => {
                        console.error(error);
                        return res.send(error)
                    });
                //------
            })
            .catch(error => {
                console.error(error);
                return res.send(error)
            });
        //---
    }
    else{
        res.status(401).send()
    }
})

//------------------------------------------//

//------------------API---------------------//

app.get("/api/price",(req,res) => {
    var slug = req.query.coin
    var options = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?convert=EUR&slug=" + slug + "&CMC_PRO_API_KEY=c58cb269-b94b-4590-8593-88278eeb1d20"
    
    var coin = require("./coin.json") 
    var id = coin[slug]
    
    axios
        .get(options)
        .then(res2 => {
            var info = res2.data
            var prezzo = info.data[id].quote.EUR.price
            console.log("prezzo "+ slug + ": " + prezzo)
            res.json({"prezzo" : prezzo})
        })
        .catch(error => {
            console.error(error)
        })
})

app.get("/api/stats", (req,res) => {

    var options = "https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest?convert=EUR&CMC_PRO_API_KEY=c58cb269-b94b-4590-8593-88278eeb1d20"

    axios
        .get(options)
        .then(res2 => {
            var info = res2.data
            var  total_market_cap = info.data.quote.EUR.total_market_cap
            var btc_dominance = info.data.btc_dominance
            var total_volume_24h = info.data.quote.EUR.total_volume_24h
            console.log("total_market_cap: " + total_market_cap)
            console.log("btc_dominance: " + btc_dominance)
            console.log("total_volume_24h: " + total_volume_24h)

            res.json({"total_market_cap" : total_market_cap, "btc_dominance" : btc_dominance, "total_volume_24h" : total_volume_24h})
        })
        .catch(error => {
            console.error(error)
        })
}) 

app.get("/api/gas", (req,res) => {

    var options = "https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=GMSE8824IKYNINNDUUE77U1FRRCSKPMEST"

    axios
        .get(options)
        .then(res2 => {
            var info = res2.data
            var low = info.result.SafeGasPrice
            var average = info.result.ProposeGasPrice
            var high = info.result.FastGasPrice
            console.log("low: " + low)
            console.log("average: " + average)
            console.log("high: " + high)
            res.json({"low" : low, "average" : average, "high" : high})
            //res.status(200).send()
        })
        .catch(error => {
            console.log("ERROREE")
            console.error(error)
        })
}) 

//------------------------------------------//

app.get("/prova", isAuth, (req,res)=>{
    res.send("sei autenticato")
})

app.get("/auth", (req,res)=>{
    res.send(req.session.isAuth) 
})

 
app.listen(3000,console.log("server listening on port 3000..."))
