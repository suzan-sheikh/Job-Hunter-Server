const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 4000;
const app = express();

const corsOptions = {
  origin: ["http://localhost:5173"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ykkxidd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {

    const jobsCollection = client.db('freelancer').collection('jobs')
    const postJobCollection = client.db('freelancer').collection('postJobs')

    // get all data from DB
    app.get('/jobs', async(req, res) => {
        const result = await jobsCollection.find().toArray()
        res.send(result)        
    })
    
    // get a single job data
    app.get('/job/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await jobsCollection.findOne(query)
      res.send(result)
    })

    // save job to mongoDB
    app.post('/jobs', async(req, res) => {
      const postData = req.body;
      const result = await postJobCollection.insertOne(postData)
      res.send(result)
    })

    



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
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

//   freelancer
//   RPkJEgqZj4Or4Epg
