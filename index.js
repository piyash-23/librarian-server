const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3000;

const admin = require("firebase-admin");

const serviceAccount = require("./librarian-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const verifyFireBase = async (req, res, next) => {
  const token = req.headers?.authorization;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    // console.log("decoded in the token", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.6ecqvku.mongodb.net/?appName=Cluster0`;

const stripe = require("stripe")(`${process.env.STRIPE_KEY}`);

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
    const paymentColl = librarian.collection("paymentCollection");
    const librarianColl = librarian.collection("librarianCollection");
    // middle
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userColl.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // cart related apis
    // cart add
    app.post("/carts", async (req, res) => {
      const cart = req.body;
      cart.paymentStatus = "unpaid";
      cart.addedAt = new Date();
      cart.orderStatus = "pending";
      const result = await cartColl.insertOne(cart);
      res.send({ message: "added to cart" }, result);
    });
    // find cart
    app.get("/carts", async (req, res) => {
      const query = {};
      const { buyerEmail, sellerEmail } = req.query;
      // console.log(buyerEmail, sellerEmail);
      if (buyerEmail) {
        query.buyerEmail = buyerEmail;
      }
      if (sellerEmail) {
        query.sellerEmail = sellerEmail;
      }

      // if (email) {
      //   query.$or = [{ buyeremail: email }, { sellerEmail: email }];
      // }
      const cursor = cartColl.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.patch("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const orderStatus = req.body.orderStatus;
      const query = { _id: new ObjectId(id) };
      const updateCart = {
        $set: {
          orderStatus: orderStatus,
        },
      };
      const result = await cartColl.updateOne(query, updateCart);
      res.send({ message: "shipped" }, result);
    });
    // delete cart
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartColl.deleteOne(query);
      res.send({ message: "deleted cart" }, result);
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
    app.patch(
      "/librarian/:id",
      verifyFireBase,
      verifyAdmin,
      async (req, res) => {
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
      }
    );
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
      const cursor = booksColl.find(query).sort({ createdAt: -1 });
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
    app.get("/user", verifyFireBase, async (req, res) => {
      const cursor = userColl.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    // single user
    app.get("/user/:id", async (req, res) => {});
    app.get("/user/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userColl.findOne(query);
      res.send({ role: user?.role || "user" });
    });
    // update users
    app.patch(
      "/user/:id/role",
      verifyFireBase,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const user = req.body;
        const role = user.role;
        const updateInfo = { $set: { role: role } };
        const result = await userColl.updateOne(query, updateInfo);
        res.send({ message: "updated" }, result);
      }
    );
    // payment related apis
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.price) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency: "BDT",
              product_data: {
                name: `Please pay for ${paymentInfo.title}`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.buyerEmail,
        metadata: {
          productId: paymentInfo.bookId,
          sellerEmail: paymentInfo.sellerEmail,
          customer_email: paymentInfo.buyerEmail,
          bookTitle: paymentInfo.title,
        },
        mode: "payment",
        success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-canceled`,
      });
      // console.log(session);
      res.send({ url: session.url });
    });
    // verify payment
    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const transactionId = session.payment_intent;
      console.log("session retrieved", session);
      const payment = {
        sellerEmail: session.metadata.sellerEmail,
        buyerEmail: session.metadata.customer_email,
        productId: session.metadata.productId,
        bookTitle: session.metadata.bookTitle,
        transactionId: session.payment_intent,
        price: session.amount_total / 100,
        paymentStatus: session.payment_status,
      };
      if (session.payment_status === "paid") {
        const id = session.metadata.productId;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            paymentStatus: "paid",
          },
        };
        const result = await cartColl.updateOne(query, update);
        res.send(result);
        const queryForPayment = { transactionId: transactionId };
        const isExistPayment = await paymentColl.findOne(queryForPayment);
        if (!isExistPayment) {
          const resultPayment = await paymentColl.insertOne(payment);

          res.send(resultPayment);
        }
      }
      res.send({ success: true });
    });

    app.get("/payments", verifyFireBase, async (req, res) => {
      const query = {};
      const { buyerEmail, sellerEmail } = req.query;
      // console.log(buyerEmail, sellerEmail);
      if (buyerEmail) {
        query.buyerEmail = buyerEmail;
        if (buyerEmail !== req.decoded_email) {
          return res.status(403).send({ message: "forbidden" });
        }
      }
      if (sellerEmail) {
        query.sellerEmail = sellerEmail;
        if (sellerEmail !== req.decoded_email) {
          return res.status(403).send({ message: "forbidden" });
        }
      }
      // console.log("headers:", req.headers);
      const cursor = paymentColl.find(query);
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
