-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: inventory_system
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `auth_users`
--

DROP TABLE IF EXISTS `auth_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `mobile` varchar(15) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `role` varchar(20) NOT NULL DEFAULT 'user',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `mobile` (`mobile`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_users`
--

LOCK TABLES `auth_users` WRITE;
/*!40000 ALTER TABLE `auth_users` DISABLE KEYS */;
INSERT INTO `auth_users` VALUES (1,'harshsingh','singhharsh8877@gmail.com','9876543210','$2b$10$PXtmfXJrfFRm0VyAXXQOcO1eOAEu/gWtX4SUfS4oOYDCNqXADvPSS','2026-04-02 04:16:19','user'),(2,'singhharsh','singhharsh6256@gmail.com','8770184089','$2b$10$wBUuwmCJ19hMelfrrD4EeeM67hCw2hWxL1/HjGYAcNd5FbM8Y5dre','2026-04-02 04:59:25','user'),(3,'Shivendra singh','singhshiv345@gmail.com','6301193430','$2b$10$EOOVXCiKzWM9tUy8GUKCIuVTggOcHL5UA86PJQkuWFP/kQ2MYnvJ.','2026-04-02 06:28:40','user'),(4,'priya','priyamaurya6052@gmail.com','6307886052','$2b$10$RM/z1/EQbDi3AQz5rM7QI.O8CZMEGygS3dFQ3ZGhvv1xoS15hb3Q.','2026-04-13 12:21:01','admin'),(5,'ananya gupta','ananya@gmail.com','9874849348','$2b$10$avKuSXL5sXtUrB8ieYcUvOdno9/2lFj.fOenVc3DCSdCwsOHB4Raa','2026-04-18 04:06:06','user'),(6,'Jyoti ','jyoti@gmail.com','9876543211','$2b$10$4myDUwSfbPHrLnT/dZh4K.E6GBH9vR4p/Q3eO8T5HiKjbk8WhGCdK','2026-04-18 04:18:00','user'),(7,'Naina','naina@gmail.com','9876556789','$2b$10$fl.7nUjxz4Rre6hkYGRqaOlWli2vkNdWeXDraQ39FITh0EUKnRl2S','2026-04-18 04:19:42','user'),(8,'monika','monika@gmail.com','9876543200','$2b$10$uKo7jGSpuVUTWvQYsZJIV.2NlXMgAYzjgyYu7XNNyURDV7.ga9QQi','2026-04-29 06:46:14','user'),(9,'Nishi Sharma','nishi123@gmail.com','8765432100','$2b$10$NotwaYmCSNrnL6u/mqr44upU7/ejmuuyW04jDmiRMvwtEhs2LUL1q','2026-05-01 09:22:41','user'),(10,'anjali','anjali@gmail.com','9876553211','$2b$10$vDIfZPW6TD8mid5r5nRlOOHXNyZrrzfZmmAycEK0BAQecwvubmlwO','2026-05-06 07:15:15','user'),(11,'avantika','avan1234@gmail.com','7754234355','$2b$10$lXtq8QqEmJNsEWgQDr6c6O/OUcYBnojOEjPIzGlQJrZKdBi51K2Qu','2026-05-06 08:36:44','user'),(12,'Pawan Maurya','pawanmaurya1248@gmail.com','7705819010','$2b$10$X2.VH0miZH9B4WvELl0uHO/k/WDvCrfDGmV4TCOEK6DARD..1Hz9i','2026-05-11 06:57:29','user');
/*!40000 ALTER TABLE `auth_users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-13 12:12:47
