const mongoose = require('mongoose')

const bookingSchema = new mongoose.Schema({
    place: {type:mongoose.Schema.Types.ObjectId,required:true,ref:'Place'},
    user: {type:mongoose.Schema.Types.ObjectId,required:true},
    checkIn: {type:String,required:true},
    checkOut: {type:String,required:true},
    name: {type:String,required:true},
    phone: {type:String,required:true},
    price: Number,

})

const BookingModel = mongoose.model('Booking',bookingSchema)

module.exports = BookingModel;