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
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `employee_id` varchar(50) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `added_by` int DEFAULT NULL,
  `auth_user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_user_id` (`auth_user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=92 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Alice','EMP001','IT',NULL,NULL),(2,'Bob','EMP002','Telecommunication',NULL,NULL),(3,'Charlie','EMP003','IT',NULL,NULL),(7,'Harsh','EMP004','it',NULL,NULL),(12,'Vishal Modanwal','EMP4','IT',NULL,NULL),(13,'Rahul','EMP101','IT',NULL,NULL),(14,'Vishnu Sonkar','EMP211','IT',NULL,NULL),(34,'Vishnu Sonkar','EMP91','IT',NULL,NULL),(36,'Vishnu akash','EMP81','IT',NULL,NULL),(38,'harshit Yadav','V2881','Tele',NULL,NULL),(39,'bindu','v211','CSE',NULL,NULL),(65,'ecec','efe','wecfwf',NULL,NULL),(66,'dwddwdd','wd','dxd',NULL,NULL),(67,'cwdw','cwece','ecwce',NULL,NULL),(68,'harsh','EMP599','it',NULL,NULL),(69,'Vishal Modanwal','EMP877','IT',NULL,NULL),(70,'Vishal Modanwal','	EMP877','IT',NULL,NULL),(71,'Harsh','877','it',NULL,NULL),(72,'Harsh Vradhan','EMP2611','IT',NULL,NULL),(73,'cjqcbq','cejcne','bcehqcb',NULL,NULL),(74,'new','qcqd','it',NULL,NULL),(75,'vibhuti','AT002','IT',NULL,NULL),(76,'dff','ff2','2f2f',NULL,NULL),(77,'jdwcnjw','e2fj','it',NULL,NULL),(78,'elfm2k','2ej2d','jnde',NULL,NULL),(79,'enzyem','dk3od','IT',NULL,NULL),(80,'Chrantan','9886','IT',NULL,NULL),(81,'priya maurya','EMP998','IT',NULL,NULL),(82,'Priyaa','Pm001','CA',NULL,NULL),(83,'uyitk','jtjkuku','ghg',NULL,NULL),(84,'nishi sharma','nishi6052','CSE',NULL,NULL),(85,'ragini','EMP013','ca',NULL,NULL),(86,'avantika','av23','cse',NULL,NULL),(87,'avantika','avan123','cse',NULL,11),(88,'ronit','kumar','cse',NULL,NULL),(89,'pawan','PM89','ca',NULL,12),(90,'riya','RV12','cse',NULL,7),(91,'monika','MN123','it',NULL,8);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
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
