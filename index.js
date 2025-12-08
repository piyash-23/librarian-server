const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.6ecqvku.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Librarian Server running");
});

const run = async () => {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const librarian = client.db("librarian");
    const booksColl = librarian.collection("booksCollection");
    // get books
    app.get("/books", async (req, res) => {
      const query = {};
      console.log(req.query);
      const { email } = req.query;
      if (email) {
        query.sellerEmail = email;
      }
      const cursor = booksColl.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // get single books
    app.get("/books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await booksColl.findOne(query);
      res.send(result);
    });
    // post books
    app.post("/books", async (req, res) => {
      const books = req.body;
      books.createdAt = new Date();
      const result = await booksColl.insertOne(books);
      res.status(200).send({ message: "book added" }, result);
    });
    // update books
    app.patch("/books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateBooks = req.body;
      updateBooks.updatedAt = new Date();
      const update = {
        $set: updateBooks,
      };
      const result = await booksColl.updateOne(query, update);
      res.send(result);
    });
    // delete books
    app.delete("/books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await booksColl.deleteOne(query);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
};
run().catch(console.dir);
app.listen(PORT, () => {
  console.log("server running");
});
