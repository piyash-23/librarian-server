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

const filteredUpadateData = (data) => {
  const filteredData = {};
  for (const key in data) {
    if (
      data[key] !== "" &&
      data[key] !== null &&
      data[key] !== undefined &&
      key !== "_id"
    ) {
      filteredData[key] = data[key];
    }
  }
  return filteredData;
};

const run = async () => {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const librarian = client.db("librarian");
    const booksColl = librarian.collection("booksCollection");
    const cartColl = librarian.collection("cartCollection");
    const userColl = librarian.collection("userCollection");
    const librarianColl = librarian.collection("librarianCollection");
    // cart related apis
    // cart add
    app.post("/carts", async (req, res) => {
      const cart = req.body;
      cart.paymentStatus = "unpaid";
      cart.addedAt = new Date();
      const result = await cartColl.insertOne(cart);
      res.send({ message: "added to cart" }, result);
    });
    // find cart
    app.get("/carts", async (req, res) => {
      const query = {};
      const { email } = req.query;
      if (email) {
        query.email = email;
      }
      const cursor = cartColl.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // librarian related apis
    // post librarian
    app.post("/librarian", async (req, res) => {
      const librarian = req.body;
      librarian.status = "pending";
      librarian.createdAt = new Date();
      const query = { email: req.body.email };
      const isExisted = await librarianColl.findOne(query);
      if (isExisted) {
        return res.send({ message: "data is already axisted" });
      }
      const result = await librarianColl.insertOne(librarian);
      res.send({ message: "librarian posted" }, result);
    });
    // delete librarian
    app.delete("/librarian/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = librarianColl.deleteOne(query);
      res.send({ message: "deleted" }, result);
    });
    // update librarian
    app.patch("/librarian/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const librarian = req.body;
      const status = librarian.status;
      librarian.updatedAt = new Date();
      const updatedInfo = {
        $set: {
          status: status,
        },
      };
      const result = await librarianColl.updateOne(query, updatedInfo);
      if (status === "approved") {
        const email = req.body.email;
        const userQuery = { email };
        const updateUser = {
          $set: {
            role: "librarian",
          },
        };
        const userResult = await userColl.updateOne(userQuery, updateUser);
      }
      res.send({ message: "updated" }, result);
    });
    // get librarians
    app.get("/librarian", async (req, res) => {
      const query = {};
      const { status } = req.query;
      if (status) {
        query.status = status;
      }
      const cursor = librarianColl.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // get books
    app.get("/books", async (req, res) => {
      const query = {};
      // console.log(req.query);
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
      const updateBooks = filteredUpadateData(req.body);
      if (Object.keys(updateBooks).length === 0) {
        return res.status(400).send({ message: "No field is updated" });
      }
      updateBooks.updatedAt = new Date();
      const update = {
        $set: updateBooks,
      };
      try {
        const result = await booksColl.updateOne(query, update);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "No book found" });
        }
        res.send({ message: "book updated" }, result);
      } catch (error) {
        res.status(500).send({ message: `update error: ${error}` });
      }
    });
    // delete books
    app.delete("/books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await booksColl.deleteOne(query);
      res.send({ message: "item deleted" }, result);
    });

    // user related apis
    // post user
    app.post("/user", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.createdAt = new Date();
      const query = { email: req.body.email };
      const existedUser = await userColl.findOne(query);
      if (existedUser) {
        return res.send({ message: "user already existed" });
      }
      const result = await userColl.insertOne(user);
      res.send({ message: "user create" }, result);
    });
    // get users
    app.get("/user", async (req, res) => {
      const cursor = userColl.find();
      const result = await cursor.toArray();
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
