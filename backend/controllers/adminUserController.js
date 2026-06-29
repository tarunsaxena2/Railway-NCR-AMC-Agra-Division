const { query } = require('../config/db');
const bcrypt = require('bcryptjs'); 

exports.getAllUsers = async (req, res) => {
    try {
        
        const result = await query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all users for admin:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body; 
    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role provided' });
    }

    try {
        const result = await query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
            [role, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        
        await query('DELETE FROM complaints WHERE user_id = $1', [id]); 
        const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully', id });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};