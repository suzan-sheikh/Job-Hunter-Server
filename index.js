require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 4000;
const app = express();

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://upwork-8699b.web.app",
    "https://upwork-8699b.firebaseapp.com",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// jwt middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "unauthorize access" });
  // console.log(token);
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        // console.log(err);
        return res.status(401).send({ message: "unauthorize access" });
      }
      // console.log(decoded);
      req.user = decoded;
      next();
    });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ykkxidd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// const uri = "mongodb://localhost:27017";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const cookeOption = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  secure: process.env.NODE_ENV === "production" ? true : false,
};

async function run() {
  try {
    const jobsCollection = client.db("freelancer").collection("jobs");
    const feedbackCollection = client.db("freelancer").collection("feedback");

    const appliedJobCollection = client
      .db("freelancer")
      .collection("appliedJobs");

    // jwt generate
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "30d",
      });
      res.cookie("token", token, cookeOption).send({ success: true });
    });

    // clear token
    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          secure: process.env.NODE_ENV === "production" ? true : false,
          maxAge: 0,
        })
        .send({ success: true });
    });

    // get a single job data
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // get data filter by email
    app.get("/jobs/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;
      console.log("tokenEmail:", tokenEmail, "userEmail", email);
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { "buyer.email": email };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    // save job to mongoDB
    app.post("/job", async (req, res) => {
      const jobData = req.body;
      const result = await jobsCollection.insertOne(jobData);
      res.send(result);
    });


    const sendEmail = (emailAddress, emailData)=> {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: "smtp.gmail.email",
        port: 587,
        secure: false, // Use `true` for port 465, `false` for all other ports
        auth: {
          user: process.env.TRANSPORTER_EMAIL,
          pass: process.env.TRANSPORTER_PASS,
        },
      });  
      
      // verify transporter
      transporter.verify(function (error, success) {
        if (error) {
          console.log(error);
        } else {
          console.log("Server is ready to take our messages");
        }
      });
      const mailBody = {
        from: `"JobHunter" <${process.env.TRANSPORTER_EMAIL}>`, // sender address
        to: emailAddress, // list of receivers
        subject: emailData.subject, // Subject line
        html: emailData.message, // html body
      }      
      transporter.sendMail(mailBody, (error, info) => {
        if(error){
          console.log(error)
        }else{
          console.log('email sent:', + info.response);
        }
      });
    }

    // feedback save to mongoDB
    app.post("/feedback", async (req, res) => {
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      sendEmail(feedback?.email, {
        subject: 'Thank for Your Feedback',
        message: 'Dear User, Thank you for taking the time to provide us with your valuable feedback. We truly appreciate your input and are committed to using it to improve our services. Best regards, Md Suzan Sheikh'
      })
      res.send(result);
    });

    // update job in mongoDB
    app.put("/job/:id", async (req, res) => {
      const id = req.params.id;
      const jobData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...jobData,
        },
      };
      const result = await jobsCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // applied Jobs to mongoDB
    app.post("/applyJob", async (req, res) => {
      const applyData = req.body;

      // check if its a duplicate request
      const query = {
        email: applyData.email,
        jobId: applyData.jobId,
      };
      const alreadyApplied = await appliedJobCollection.findOne(query);

      if (alreadyApplied) {
        return res.status(400).send("already Apply");
      }

      const postData = req.body;
      const result = await appliedJobCollection.insertOne(postData);

      // update Job Applicant Number
      const updateDoc = {
        $inc: { job_applicant_number: 1 },
      };
      const jobQuery = { _id: new ObjectId(postData.jobId) };
      const updateJobNumber = jobsCollection.updateOne(jobQuery, updateDoc);
      console.log(updateJobNumber);

      res.send(result);
    });

    // delete a job data
    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });

    // data for pagination
    app.get("/jobsCount", async (req, res) => {
      const search = req.query.search;

      let query = {
        job_title: { $regex: search, $options: "i" },
      };
      const count = await jobsCollection.countDocuments(query);
      res.send({ count });
    });

    app.get("/allJobs", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const search = req.query.search;

      let query = {
        job_title: { $regex: search, $options: "i" },
      };

      const result = await jobsCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // get all data from DB
    app.get("/jobsSearch", async (req, res) => {
      const search = req.query.search;
      let query = {};
      if (search) {
        query.job_title = { $regex: search, $options: "i" };
      }

      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/applyJob/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;
      const filter = req.query.filter;

      // Check if the token email matches the requested email
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      // Define the base query with the email
      let query = { email };

      // If a filter is provided, add it to the query
      if (filter) {
        query.category = filter;
      }

      console.log(query);

      try {
        // Find applied jobs based on the query
        const result = await appliedJobCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server running.....");
});

app.listen(port, () => {
  console.log(`server running on', ${port}`);
});
