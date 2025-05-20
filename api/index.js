const express = require("express");
require("dotenv").config();
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
// const CookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader')
const Place = require('./models/Place.js')
const cookieParser = require("cookie-parser");
const multer = require('multer')
const fs =  require('fs');
const Booking = require("./models/Booking.js");
const { resolve } = require("path");

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const app = express();
const clientUrl = process.env.CLIENT_URL;
const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = process.env.JWT_SECRET;

app.use(express.json());
app.use(cookieParser());

app.use('/uploads',express.static(__dirname+'/uploads'));
// console.log(process.env.MONGO_URL)
mongoose.connect(process.env.MONGO_URL);

function getUserDataFromReq(req){
  return new Promise((resolve,reject)=>{
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if(err) throw err;
      resolve(userData)
    })
  })
}

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  })
);

app.get("/test", (req, res) => {
  res.json("test ok");
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const userDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const userDoc = await User.findOne({ email });
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign(
        {
          email: userDoc.email,
          id: userDoc._id,
        },
        jwtSecret,
        {},
        (err, token) => {
          if (err) throw err;
          res.cookie("token", token).json(userDoc);
        }
      );
    } else {
      res.status(422).json("pass not ok");
    }
  } else {
    res.json("Not Found");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      const { name, email, _id } = await User.findById(userData.id);
      res.json({ name, email, id: _id });
    });
  } else {
    res.json(null);
  }
});


app.post('/logout',(req,res) => {
    res.cookie('token',"").json(true);
})

app.post('/upload-by-link', async (req, res) => {
    const { link } = req.body;
    const newName = 'photo' + Date.now() + '.jpg';
    const dest = __dirname + '/uploads/' + newName;

    try {
        await imageDownloader.image({
            url: link,
            dest: dest
        });
        res.json(newName);
    } catch (error) {
        console.error("Error downloading image:", error.message);
        res.status(500).json({ error: "Failed to download image" });
    }
});

const photosMiddleware = multer({dest:'uploads/'})
app.post('/upload', photosMiddleware.array('photos',100),(req,res)=>{
  const uploadedFiles = [];  
  for(let i=0;i<req.files.length;i++){
      const {path,originalname} = req.files[i];
      const parts = originalname.split('.')
      const ext = parts[parts.length-1]
      const newPath = path + '.' + ext;
      fs.renameSync(path,newPath)
      uploadedFiles.push(newPath.replace('uploads/',''));
    }
    res.json(uploadedFiles);
})

app.post('/places', (req,res)=>{
  const {token} = req.cookies;
  const {
    title,address,addedPhotos,description,price
    ,perks,extraInfo,checkIn,checkOut,maxGuests,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.create({
      owner: userData.id,price,
      title,address,photos:addedPhotos,description
      ,perks,extraInfo,checkIn,checkOut,maxGuests,
    })
    res.json(placeDoc)
  });
})


app.get('/user-places',(req,res)=>{
  const {token} = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const {id} = userData;
    res.json(await Place.find({owner:id}))
  });

})

app.get('/places/:id',async (req,res)=>{
  const {id} = req.params;
  res.json(await Place.findById(id))
})

app.put('/places',async(req,res)=>{
  
  const {token} = req.cookies;
  const {
    id, title,address,addedPhotos,description
    ,perks,extraInfo,checkIn,checkOut,maxGuests,price,
  } = req.body;
  
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if(err) throw err;

    const placeDoc = await Place.findById(id);
    if(userData.id === placeDoc.owner.toString()){
      placeDoc.set({
        title,address,photos:addedPhotos,description
        ,perks,extraInfo,checkIn,checkOut,maxGuests,price
      })
      await placeDoc.save();
      res.json('ok')
    }
  })
})

app.get('/places',async (req,res)=>{
  res.json(await Place.find())
})

app.post('/bookings', async (req,res)=>{

  const userData = await getUserDataFromReq(req);
  const {
    place,checkIn,checkOut,
    numberOfGuests,name,phone,price
  } = req.body;

   Booking.create({
    place,checkIn,checkOut,
    numberOfGuests,name,phone,price,
    user:userData.id,
  }).then((doc)=>{
    res.json(doc)
  }).catch((err)=>{
    throw err;
  })

})



app.get('/bookings',async (req,res)=>{
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({user:userData.id}).populate('place'))
})

app.post('/create-payment-session', async (req, res) => {
  const { bookingId, amount } = req.body;
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Booking Payment',
          },
          unit_amount: amount * 100, // Stripe uses cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancelled`,
      metadata: {
        bookingId: bookingId,
      },
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating payment session:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

app.listen(4000);