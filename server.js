
import express from 'express';
import cors from 'cors';
import { MongoClient,ObjectId } from 'mongodb';
import dotenv from "dotenv";
dotenv.config();

const app=express();
app.use(cors());
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL;
const PORT=process.env.PORT;

async function createConnection(){
    let client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log("***connected to mongodb***");
    return client;
}

let client = await createConnection();

app.get("/", (req,res) =>{
    res.send(`<center><b><h3>Hall booking API</h3></b></center><br/><br/>
    <u>List of APIs</u><br/><br>
    1. Create room<br/>path-/create-room<br/>method- "POST"<br/>data - raw, json<br/>
    body (sample) - {
        "name": "room1",
        "seats": 100,
        "amenities": [
          "AC",
          "intercom",
          "internet",
          "projector",
          "projector screen",
          "Video Conferencing system"
        ],
        "pricePerHr": 1500
      }<br/><br/>
      2. Room Booking<br/>path-/book-room<br/>method- "POST"<br/>data - raw, json<br/>
      body (sample) - {
        "customer_name": "cust1",
        "Date": "9/19/2022",
        "StartTime": "9/19/2022 11:30:00",
        "EndTime": "9/19/2022 2:45:00",
        "room_id": "62d52593e5d9beaf9d690926"
      }<br/><br/>
      3. List all rooms<br/>path - /room-status<br/>method - "GET"<br/><br/>
      4. List all customer<br/>path - /customers<br/>method- "GET"
    `);
})

//create room api starts
app.post("/create-room" , async(req,res) => {
    let room = req.body;
    let getAllRooms = await client.db("hallbooking").collection("rooms").find().toArray();
    
    //find the room with given name in db
    //if they already exists send error message
    let roomExists = await client.db("hallbooking").collection("rooms").findOne({name:room.name});

    if(roomExists){
        res.send(`Room with name ${room.name} already exists. Create room with a different name.`);
    }
    else{
        let result = await client.db("hallbooking").collection("rooms").insertOne(room);
        res.send(result);
    }
})
//create room api ends

app.post("/book-room", async(req,res) => {
    let details = req.body;

    //convert input string to local date and time string
    let date=covertDate(details.Date);
    details.Date = date;
    let startTime = getStartTime(details.StartTime);
    details.StartTime = startTime;
    let endTime = getEndTime(details.EndTime);
    details.EndTime = endTime;
    let roomExists;
    let availability=true;

    //gett all bookings
    let getAllBookings = await client.db("hallbooking").collection("bookings").find().toArray();
    //get room id and date from all bookings
    getAllBookings.map((obj) => {
        if(obj.room_id === details.room_id){
          if(obj.Date === details.Date){
            //get the already booked date
            let booked_date_startTime =`${obj.Date} ${obj.StartTime}`;
            let booked_date_endTime =`${obj.Date} ${obj.EndTime}`;
            
            //get the date new customer trying to book via api 
            let booking_date_startTime = `${details.Date} ${details.StartTime}`;
            let booking_date_endTime = `${details.Date} ${details.EndTime}`;


            booked_date_startTime = new Date(booked_date_startTime).getTime();
            booked_date_endTime = new Date(booked_date_endTime).getTime();

            booking_date_startTime = new Date(booking_date_startTime).getTime();
            booking_date_endTime = new Date(booking_date_endTime).getTime();

            //set availability true if new customers start time and end time in less than or equal to booked meeting's start time
            //or greater than or equal to booked meeting's end time
            if((booking_date_startTime <= booked_date_startTime && booking_date_endTime <= booked_date_startTime) || 
            (booking_date_startTime >= booked_date_endTime)){
                availability=true;
            }
            else{
                availability=false;
            }

          }
        }
    })

    try{
         roomExists = await client.db("hallbooking").collection("rooms").findOne({_id:ObjectId(details.room_id)});
         if(roomExists){
            if(availability){
                let result = await client.db("hallbooking").collection("bookings").insertOne(details);
            res.send(result);
            }
            else{
                res.send("Room is not available for the selected time. Please choose a different time");
            }
            
        }
        else{
        res.send(`Room does not exist`);
        }
    }
    catch(error){ //to catch error if id is not of 12 bytes
        console.log(error);
        res.send("Enter the correct details");
    }
    
})

app.get("/customers", async (req,res) => {
    let allBookings = await client.db("hallbooking").collection("bookings").find().toArray();
    let allRooms = await client.db("hallbooking").collection("rooms").find().toArray();


   let custs= allBookings.map((obj) => {
    let name="";
    for(let i=0;i<allRooms.length;i++){
        if(allRooms[i]._id.toString() === obj.room_id){
            name=allRooms[i].name;
            break;
        }
    }
    return (    
        {customer_name:obj.customer_name,
            Date:obj.Date,
            StartTime:obj.StartTime,
            EndTime:obj.EndTime,
            room_name:name
            })
    } )

    res.send(custs);
})


app.get("/room-status", async (req,res) => {
    let allBookings = await client.db("hallbooking").collection("bookings").find().toArray();
    let allRooms = await client.db("hallbooking").collection("rooms").find().toArray();
    

    let roomsStatus = allRooms.map((obj) =>{
        let booked_status="Available for booking";
        let end_time = "To be booked";
        let customer_name="To be booked";
        let date ="To be booked";
        let start_time= "To be booked";
        let arr= [];
       

        for(let i=0;i<allBookings.length;i++){
            //check if room is available in the bookings table
            if(obj._id.toString() === allBookings[i].room_id){
                let details={};
                booked_status="Booked";
               
                //put the list of customer booked a particular room as array of objects
                details.customer_name=allBookings[i].customer_name;
                details.date=allBookings[i].Date;
                details.start_time = allBookings[i].StartTime;
                details.end_time = allBookings[i].EndTime;
                arr.push(details);
            }
        }
        return(
            {
                room_name:obj.name,
                booked_status:booked_status,
                bookings_details:arr
            }
        )
    })

    res.send(roomsStatus);
})



app.listen(PORT, (error) => {
    if(error){
        console.log(error);
    }
    else{
        console.log(`App is listening to port ${PORT}`);
    }
})


function covertDate(date){
let inp =date;
let date_inp = new Date(inp);
let res = date_inp.toLocaleDateString();
return res;
}

function getStartTime(start_time){
    let stime = new Date(start_time);
    let res= stime.toLocaleTimeString();
    return res;
}

function getEndTime(end_time){
    let etime = new Date(end_time);
    let res= etime.toLocaleTimeString();
    return res;
}
