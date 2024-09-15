const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.fn3uv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}
run().catch(console.dir);

app.get('/fetch-and-store', async (req, res) => {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/Bit-Code-Technologies/mockapi/main/purchase.json');
    const fetchedData = response.data;
    console.log("Fetched Data:", fetchedData);

    const processedReport = fetchedData.map((item) => ({
      productName: item.product_name,
      customerName: item.name,
      quantity: item.purchase_quantity,
      price: parseFloat(item.product_price),
      total: item.purchase_quantity * parseFloat(item.product_price),
    }));

    const grossQuantity = processedReport.reduce(
      (acc, item) => acc + item.quantity,
      0
    );
    const totalPrice = processedReport.reduce(
      (acc, item) => acc + item.price,
      0
    );
    const grossTotal = processedReport.reduce(
      (acc, item) => acc + item.total,
      0
    );

    const db = client.db('store');
    const collection = db.collection('products');
    await collection.deleteMany({}); 
    await collection.insertMany(processedReport);

    res.json({
      items: processedReport,
      gross: { quantity: grossQuantity, total: grossTotal, price: totalPrice },
    });
  } catch (err) {
    console.error('Error fetching and storing data:', err);
    res.status(500).send('Error fetching and storing data');
  }
});


app.get('/data', async (req, res) => {
  try {
    const db = client.db('store');
    const collection = db.collection('products');
    const data = await collection.find().toArray();

    const grossQuantity = data.reduce((acc, item) => acc + item.quantity, 0);
    const totalPrice = data.reduce((acc, item) => acc + item.price, 0);
    const grossTotal = data.reduce((acc, item) => acc + item.total, 0);

    res.json({
      items: data,
      gross: { quantity: grossQuantity, total: grossTotal, price: totalPrice },
    });
  } catch (err) {
    console.error('Error show data:', err);
    res.status(500).send('Error show data');
  }
});
app.get('/top-purchasers', async (req, res) => {
    try {
      const db = client.db('store');
      const productsCollection = db.collection('products');
  
      const topPurchasers = await productsCollection.aggregate([
        {
          $group: {
            _id: "$customerName",
            user_name: { $first: "$customerName" },
            user_email: { $first: "$customerEmail" },
            total_amount_spent: { $sum: "$total" },
            top_product: { $first: "$productName" },
            top_quantity: { $max: "$quantity" },
            top_price: { $max: "$price" }
          }
        },
        { $sort: { total_amount_spent: -1 } }
      ]).toArray();

      const grossQuantity = topPurchasers.reduce((acc, user) => acc + user.top_quantity, 0);
      const totalPrice = topPurchasers.reduce((acc, user) => acc + user.top_price, 0);
      const grossTotal = topPurchasers.reduce((acc, user) => acc + user.total_amount_spent, 0);
  
    //   res.json(topPurchasers);
    res.json({
        topPurchasers,
        grossQuantity,
        totalPrice,
        grossTotal
      });
    } catch (err) {
      console.error('Error retrieving top purchasers:', err);
      res.status(500).send('Error retrieving top purchasers');
    }
  }); 

app.get('/', (req, res) => {
  res.send('User management server is running');
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
