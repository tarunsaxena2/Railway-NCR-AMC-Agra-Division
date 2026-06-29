
const { protect, authorize } = require('./middleware/authMiddleware'); 

app.use("/api/", protect); 

app.use("/api/complaints", complaintsRoutes); 


const adminComplaintsRoutes = require('./routes/adminComplaintsRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');

app.use("/api/admin/complaints", authorize(['admin']), adminComplaintsRoutes); 
app.use("/api/admin/users", authorize(['admin']), adminUserRoutes); 

