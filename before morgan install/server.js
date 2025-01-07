// server.js
const express = require('express');
const app = express();
// const port = 2999;
const port = process.env.PORT || 3001;

// Middleware to parse JSON bodies
// app.use(express.json()); // <-- Add this line here


// Import routes
const api1 = require('./apis/login2');
const api2 = require('./apis/checkAdmin');
const api3 = require('./apis/get_states');
const api4 = require('./apis/get_areas');
const api5 = require('./apis/get_sites');
const api6 = require('./apis/generate_site_report');;
const api7 = require('./apis/fetch_type_order_for_wtg_wise_planning');;
const api8 = require('./apis/get_total_wtg_count');
const api9 = require('./apis/get_total_planned_wtg_count');
const api10 = require('./apis/get_total_wtg_planned');
const api11 = require('./apis/get_total_open_status_wtg_count');
const api12 = require('./apis/get_completed_count');
const api13 = require('./apis/get_completed_out_of_grace_count');
const api14 = require('./apis/get_total_wtg_count_based_on_state');
const api15 = require('./apis/get_open_status_wtg_data');
const api16 = require('./apis/get_completed_wtg_data');
const api17 = require('./apis/get_completed_out_of_grace_data');
const api18 = require('./apis/get_functional_locations');
const api19 = require('./apis/fetch_schedule_plan_lubrication');

/*user side scripts */
const api20 = require('./apis/checkUser');



// Use routes with a dynamic router prefix
app.use('/api/login2', api1);
app.use('/api/checkAdmin', api2);
app.use('/api/get_states', api3);
app.use('/api/get_areas', api4);
app.use('/api/get_sites', api5);
app.use('/api/generate_site_report', api6);
app.use('/api/fetch_type_order_for_wtg_wise_planning', api7);
app.use('/api/get_total_wtg_count', api8);
app.use('/api/get_total_planned_wtg_count', api9);
app.use('/api/get_total_wtg_planned', api10);
app.use('/api/get_total_open_status_wtg_count', api11);
app.use('/api/get_completed_count', api12);
app.use('/api/get_completed_out_of_grace_count', api13);
app.use('/api/get_total_wtg_count_based_on_state', api14);
app.use('/api/get_open_status_wtg_data', api15);
app.use('/api/get_completed_wtg_data', api16);
app.use('/api/get_completed_out_of_grace_data', api17);
app.use('/api/get_functional_locations', api18);
app.use('/api/fetch_schedule_plan_lubrication', api19);

/* user side scripts */
app.use('/api/checkUser', api20);

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
