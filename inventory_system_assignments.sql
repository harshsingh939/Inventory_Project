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
-- Table structure for table `assignments`
--

DROP TABLE IF EXISTS `assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `asset_id` int DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `working_minutes` int DEFAULT NULL,
  `condition_before` varchar(100) DEFAULT NULL,
  `condition_after` varchar(100) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Active',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `asset_id` (`asset_id`),
  CONSTRAINT `assignments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `assignments_ibfk_2` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assignments`
--

LOCK TABLES `assignments` WRITE;
/*!40000 ALTER TABLE `assignments` DISABLE KEYS */;
INSERT INTO `assignments` VALUES (1,1,1,'2026-03-28 15:12:35','2026-03-28 15:17:06',4,'Good','Good','Completed'),(2,1,1,'2026-04-03 10:29:20','2026-04-03 11:18:52',49,'Good','Good','Completed'),(3,1,2,'2026-04-03 10:47:13','2026-04-29 15:12:51',37705,'Good','Good','Completed'),(4,2,1,'2026-04-03 11:19:02','2026-04-03 11:19:25',0,'Good','Good','Completed'),(5,81,4,'2026-04-03 11:21:48','2026-04-03 11:22:22',0,'Good','Good','Completed'),(6,81,1,'2026-04-29 15:11:27','2026-04-29 15:11:40',0,'Good','Good','Completed'),(7,83,4,'2026-04-29 15:12:00','2026-05-01 14:43:18',2851,'Good','Good','Completed'),(8,74,1,'2026-05-01 14:43:04','2026-05-02 10:38:50',1195,'Good','Good','Completed'),(9,84,2,'2026-05-01 14:58:19',NULL,NULL,'Good',NULL,'Active'),(10,68,7,'2026-05-01 15:11:28','2026-05-01 15:11:52',0,'Good','Good','Completed'),(11,85,4,'2026-05-02 10:38:29',NULL,NULL,'Good',NULL,'Active'),(12,85,7,'2026-05-02 10:38:43','2026-05-04 11:31:02',2932,'Good','Good','Completed'),(13,87,8,'2026-05-06 14:58:56','2026-05-08 15:34:39',2915,'Good','Good','Completed'),(14,12,9,'2026-05-06 15:19:25',NULL,NULL,'Good',NULL,'Active'),(15,72,14,'2026-05-06 15:19:35',NULL,NULL,'Good',NULL,'Active'),(16,1,10,'2026-05-06 15:29:10','2026-05-06 15:34:13',5,'Good','Good','Completed'),(17,7,10,'2026-05-06 15:34:23',NULL,NULL,'Good',NULL,'Active'),(18,7,21,'2026-05-06 17:15:51',NULL,NULL,'Good',NULL,'Active'),(19,66,17,'2026-05-06 17:20:51','2026-05-08 16:21:46',2820,'Good','Good','Completed'),(20,73,20,'2026-05-06 17:21:24',NULL,NULL,'Fair',NULL,'Active'),(21,73,35,'2026-05-06 17:21:47',NULL,NULL,'Good',NULL,'Active'),(22,65,13,'2026-05-08 14:34:35','2026-05-08 14:45:00',10,'Good','Good','Completed'),(23,69,15,'2026-05-08 14:44:40',NULL,NULL,'Good',NULL,'Active'),(24,38,29,'2026-05-08 15:02:22','2026-05-08 15:51:35',49,'Good','Good','Completed'),(25,87,28,'2026-05-08 15:06:44','2026-05-08 15:51:12',44,'Good','Good','Completed'),(26,69,33,'2026-05-08 15:09:52','2026-05-08 15:11:52',2,'Fair','Good','Completed'),(27,13,31,'2026-05-08 15:12:04','2026-05-08 15:15:41',3,'Good','Good','Completed'),(28,71,32,'2026-05-08 15:15:49','2026-05-08 15:51:37',35,'Good','Good','Completed'),(29,69,11,'2026-05-08 15:16:31','2026-05-08 15:46:56',30,'Good','Good','Completed'),(30,68,12,'2026-05-08 15:21:57','2026-05-08 16:13:36',51,'Good','Good','Completed'),(31,67,34,'2026-05-08 15:24:29',NULL,NULL,'Good',NULL,'Active'),(32,69,13,'2026-05-08 15:32:43','2026-05-08 15:49:30',16,'Poor','Good','Completed'),(33,85,16,'2026-05-08 15:33:47','2026-05-08 15:43:47',10,'Good','Good','Completed'),(34,88,36,'2026-05-11 10:59:52',NULL,NULL,'Good',NULL,'Active'),(35,82,13,'2026-05-11 11:03:19',NULL,NULL,'Good',NULL,'Active'),(36,87,8,'2026-05-11 11:09:20',NULL,NULL,'Good',NULL,'Active'),(37,87,29,'2026-05-11 14:08:04',NULL,NULL,'Good',NULL,'Active');
/*!40000 ALTER TABLE `assignments` ENABLE KEYS */;
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
