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
-- Table structure for table `history`
--

DROP TABLE IF EXISTS `history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `employee_id` varchar(50) DEFAULT NULL,
  `employee_name` varchar(255) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `status` varchar(50) DEFAULT 'Active',
  `assigned_at` timestamp NULL DEFAULT NULL,
  `returned_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `history`
--

LOCK TABLES `history` WRITE;
/*!40000 ALTER TABLE `history` DISABLE KEYS */;
INSERT INTO `history` VALUES (2,16,'85','ragini','Assigned','Completed','2026-05-08 10:03:47','2026-05-08 10:13:47','2026-05-08 10:03:47'),(5,28,'87','avantika','Returned','Completed','2026-05-08 10:21:13','2026-05-08 10:21:13','2026-05-08 10:21:13'),(6,29,'38','harshit Yadav','Returned','Completed','2026-05-08 10:21:35','2026-05-08 10:21:35','2026-05-08 10:21:35'),(7,32,'71','Harsh','Returned','Completed','2026-05-08 10:21:38','2026-05-08 10:21:38','2026-05-08 10:21:38'),(9,17,'66','dwddwdd','Returned','Completed','2026-05-08 10:51:47','2026-05-08 10:51:47','2026-05-08 10:51:47'),(10,36,'88','ronit','Assigned','Active','2026-05-11 05:29:53',NULL,'2026-05-11 05:29:53'),(11,13,'82','Priyaa','Assigned','Active','2026-05-11 05:33:19',NULL,'2026-05-11 05:33:19'),(12,8,'87','avantika','Assigned','Active','2026-05-11 05:39:20',NULL,'2026-05-11 05:39:20'),(13,29,'87','87','Assigned','Active','2026-05-11 08:38:05',NULL,'2026-05-11 08:38:05');
/*!40000 ALTER TABLE `history` ENABLE KEYS */;
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
