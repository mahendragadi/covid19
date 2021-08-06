const express = require("express");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;

const initializeDbAndSaver = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running on http://localhost:3000/");
    });
  } catch (e) {
    console.log(`Error Message ${e.message}`);
  }
};
initializeDbAndSaver();

//Authentication with Token
const AuthenticationWithToken = (request, response, next) => {
  let jwAccess;
  const userHeader = request.headers["authorization"];
  if (userHeader !== undefined) {
    jwAccess = userHeader.split(" ")[1];
  }
  if (jwAccess === undefined) {
    console.log("first");
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwAccess, "huwbegopwr89nbvjei90", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//stateDetails
const eachStateDetails = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};
//district Details
const districtView = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//login into a user
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userLoginQuery = `
    SELECT *
    FROM 
        user
    WHERE 
        username = '${username}';
    `;
  const userDetails = await db.get(userLoginQuery);
  if (userDetails !== undefined) {
    const isPasswordVerify = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordVerify === true) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "huwbegopwr89nbvjei90");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

app.get("/states/", AuthenticationWithToken, async (request, response) => {
  const statesQuery = `
    SELECT *
    FROM 
        state
    `;
  const stateDetails = await db.all(statesQuery);
  response.send(stateDetails.map((each) => eachStateDetails(each)));
});

//specific state
app.get(
  "/states/:stateId/",
  AuthenticationWithToken,
  async (request, response) => {
    const { stateId } = request.params;
    const requestingSpecState = `
    SELECT *
    FROM 
        state 
    WHERE 
        state_id = ${stateId};
    `;
    const stateDetails = await db.get(requestingSpecState);
    response.send(eachStateDetails(stateDetails));
  }
);

app.post("/districts/", AuthenticationWithToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addingDistrictRow = `
    INSERT INTO 
        district(district_name,state_id,cases,cured,active,deaths)
    VALUES
        ('${districtName}',${stateId},${cases},${cured},${active},${deaths});

    `;
  await db.run(addingDistrictRow);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  AuthenticationWithToken,
  async (request, response) => {
    const { districtId } = request.params;
    const specificDistrict = `
    SELECT *
    FROM 
       district
    where 
        district_id = ${districtId};
    `;
    const districtDetail = await db.get(specificDistrict);
    response.send(districtView(districtDetail));
  }
);

//Delete request
app.delete(
  "/districts/:districtId/",
  AuthenticationWithToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
    DELETE 
    FROM
        district 
    WHERE 
        district_id = ${districtId};
    `;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);

//Update district details
app.put(
  "/districts/:districtId/",
  AuthenticationWithToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictDetails = `
    UPDATE 
        district
    SET 
        district_name='${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE 
        district_id = ${districtId};
    `;
    await db.run(updateDistrictDetails);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  AuthenticationWithToken,
  async (request, response) => {
    const { stateId } = request.params;
    const districtDetails = `
    SELECT 
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths) 
    FROM 
        district 
    WHERE 
        state_id = ${stateId};
    `;
    const stats = await db.get(districtDetails);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
