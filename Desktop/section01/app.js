const express = require('express');
const ejs = require('ejs');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(bodyParser.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 업로드 디렉토리 생성
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// MySQL 연결 설정
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'djaqndl5795', // MySQL 비밀번호
    database: 'eat' // 연결할 데이터베이스 이름
});

// MySQL 연결
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ', err);
        return;
    }
    console.log('Connected to MySQL');
});

// 홈 페이지 및 맛집 추가 폼 표시
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/searchRestaurant', (req, res) => {
    const searchQuery = req.query.searchQuery;

    const query = 'SELECT id FROM restaurants WHERE name = ?';
    db.query(query, [searchQuery], (err, results) => {
        if (err) {
            console.error('Error searching for restaurant: ', err);
            res.status(500).send('Database error');
            return;
        }

        if (results.length > 0) {
            const restaurantId = results[0].id;
            res.redirect(`/restaurant/${restaurantId}`);
        } else {
            res.status(404).send('Restaurant not found');
        }
    });
});

// 동네별 맛집 목록 표시
app.get('/neighborhood/:location', (req, res) => {
    const location = req.params.location;
    const getRestaurantsByLocation = (location, callback) => {
        const query = 'SELECT id, name, category, details, image, description FROM restaurants WHERE location = ?';
        db.query(query, [location], (err, results) => {
            if (err) {
                return callback(err);
            }
            callback(null, results);
        });
    };

    getRestaurantsByLocation(location, (err, restaurants) => {
        if (err) throw err;
        res.render('profile', {
            location: location,
            restaurants: restaurants
        });
    });
});

// 음식 종류별 맛집 목록 표시
app.get('/category/:category', (req, res) => {
    const category = req.params.category;
    const getRestaurantsByCategory = (category, callback) => {
        const query = 'SELECT id, name, location, details, image, description FROM restaurants WHERE category = ?';
        db.query(query, [category], (err, results) => {
            if (err) {
                return callback(err);
            }
            callback(null, results);
        });
    };

    getRestaurantsByCategory(category, (err, restaurants) => {
        if (err) throw err;
        res.render('category', {
            category: category,
            restaurants: restaurants
        });
    });
});

// 맛집 세부 정보 표시 및 리뷰 목록
app.get('/restaurant/:id', (req, res) => {
    const id = req.params.id;
    const getRestaurantDetails = 'SELECT id, name, location, category, details, image, description FROM restaurants WHERE id = ?';
    const getReviews = 'SELECT rating, comment FROM reviews WHERE restaurant_id = ?';

    db.query(getRestaurantDetails, [id], (err, restaurantResult) => {
        if (err) {
            console.error('Error fetching restaurant details: ', err);
            res.status(500).send('Database error');
            return;
        }
        if (restaurantResult.length === 0) {
            res.status(404).send('Restaurant not found');
            return;
        }

        db.query(getReviews, [id], (err, reviewsResult) => {
            if (err) {
                console.error('Error fetching reviews: ', err);
                res.status(500).send('Database error');
                return;
            }

            res.render('restaurant', {
                restaurant: restaurantResult[0],
                reviews: reviewsResult
            });
        });
    });
});

// 리뷰 작성 페이지 표시
app.get('/restaurant/:id/review/new', (req, res) => {
    const id = req.params.id;
    const query = 'SELECT id, name FROM restaurants WHERE id = ?';

    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error fetching restaurant details: ', err);
            res.status(500).send('Database error');
            return;
        }
        if (result.length === 0) {
            res.status(404).send('Restaurant not found');
            return;
        }

        res.render('review', {
            restaurant: result[0]
        });
    });
});

// 리뷰 추가 처리
app.post('/restaurant/:id/review', (req, res) => {
    const restaurant_id = req.params.id;
    const { rating, comment } = req.body;

    const query = 'INSERT INTO reviews (restaurant_id, rating, comment) VALUES (?, ?, ?)';
    db.query(query, [restaurant_id, rating, comment], (err, results) => {
        if (err) {
            console.error('Error inserting review into MySQL: ', err);
            res.status(500).send('Database error');
            return;
        }
        res.redirect(`/restaurant/${restaurant_id}`);
    });
});

// 추천 게시판 보기 페이지
app.get('/recommendBoard', (req, res) => {
    const query = 'SELECT * FROM recommend_board';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching recommend board: ', err);
            res.status(500).send('Database error');
            return;
        }
        res.render('recommendBoard', { posts: results });
    });
});

// 추천 게시판 작성 페이지
app.get('/recommendBoard/new', (req, res) => {
    res.render('newRecommendBoard');
});

// 추천 게시판 작성 처리
app.post('/submitRecommendBoard', (req, res) => {
    const { title, content } = req.body;

    const query = 'INSERT INTO recommend_board (title, content) VALUES (?, ?)';
    db.query(query, [title, content], (err, results) => {
        if (err) {
            console.error('Error inserting into recommend_board: ', err);
            res.status(500).send('Database error');
            return;
        }
        res.redirect('/recommendBoard');
    });
});

// 추천 게시판 게시물 삭제 처리
app.post('/deletePost/:id', (req, res) => {
    const postId = req.params.id;
    const query = 'DELETE FROM recommend_board WHERE id = ?';
    db.query(query, [postId], (err, results) => {
        if (err) {
            console.error('Error deleting from recommend_board: ', err);
            res.status(500).send('Database error');
            return;
        }
        res.redirect('/recommendBoard');
    });
});

// 맛집 추가 폼 페이지 표시
app.get('/addRestaurant', (req, res) => {
    res.render('addRestaurant');
});

// 맛집 추가 폼 제출 처리 및 데이터베이스 저장
app.post('/addRestaurant', upload.single('image'), (req, res) => {
    const { name, location, category, details, description } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    const query = 'INSERT INTO restaurants (name, location, category, details, image, description) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(query, [name, location, category, details, image, description], (err, results) => {
        if (err) {
            console.error('Error inserting data into MySQL: ', err.sqlMessage);
            res.status(500).send(`Database error: ${err.sqlMessage}`);
            return;
        }
        res.redirect('/');
    });
});

// 추천 게시판 작성 페이지로 이동
app.get('/newPost', (req, res) => {
    res.render('newRecommendBoard');
});



app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});
