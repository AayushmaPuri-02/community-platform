const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await User.updateOne(
      { email: "aayushmapuri8080@gmail.com" },
      {
        isVerified: true,
        verificationToken: ""
      }
    );

    console.log("Admin updated");
    process.exit();
  })
  .catch(err => console.log(err));